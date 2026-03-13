using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.DTOs;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

public class StravaService(AppDbContext db, StravaTokenService tokenService, IConfiguration config, ILogger<StravaService> logger)
{
    private readonly string _clientId = config["Strava:ClientId"] ?? throw new InvalidOperationException("Strava:ClientId not configured.");
    private readonly string _clientSecret = config["Strava:ClientSecret"] ?? throw new InvalidOperationException("Strava:ClientSecret not configured.");
    private readonly string _redirectUri = config["Strava:RedirectUri"] ?? throw new InvalidOperationException("Strava:RedirectUri not configured.");

    // ── OAuth ────────────────────────────────────────────────────────────────

    public string GetAuthorizationUrl(Guid userId)
    {
        var state = userId.ToString();
        return $"https://www.strava.com/oauth/authorize" +
               $"?client_id={_clientId}" +
               $"&redirect_uri={Uri.EscapeDataString(_redirectUri)}" +
               $"&response_type=code" +
               $"&approval_prompt=auto" +
               $"&scope=read,activity:read_all,profile:read_all" +
               $"&state={state}";
    }

    public async Task ExchangeCodeForTokensAsync(string code, Guid userId, string? callbackScope = null)
    {
        using var http = new HttpClient();
        var response = await http.PostAsync("https://www.strava.com/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId,
            ["client_secret"] = _clientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code"
        }));

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();

        // Strava returns scope in the callback query string, not always in the token response body
        var scope = callbackScope
            ?? (json.TryGetProperty("scope", out var s) ? s.GetString() : null)
            ?? "";

        await tokenService.SaveTokensAsync(
            userId,
            json.GetProperty("access_token").GetString()!,
            json.GetProperty("refresh_token").GetString()!,
            json.GetProperty("expires_at").GetInt64(),
            json.GetProperty("athlete").GetProperty("id").GetInt64(),
            $"{json.GetProperty("athlete").GetProperty("firstname").GetString()} {json.GetProperty("athlete").GetProperty("lastname").GetString()}".Trim(),
            scope
        );
    }

    // ── Token management ────────────────────────────────────────────────────

    public async Task<string> GetValidAccessTokenAsync(Guid userId)
    {
        var tokens = await tokenService.GetDecryptedTokensAsync(userId)
            ?? throw new InvalidOperationException("Strava not connected.");

        if (!tokenService.IsTokenExpired(tokens.ExpiresAt))
            return tokens.AccessToken;

        return await RefreshAccessTokenAsync(userId, tokens.RefreshToken);
    }

    private async Task<string> RefreshAccessTokenAsync(Guid userId, string refreshToken)
    {
        using var http = new HttpClient();
        var response = await http.PostAsync("https://www.strava.com/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId,
            ["client_secret"] = _clientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token"
        }));

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();

        var newAccess = json.GetProperty("access_token").GetString()!;
        var newRefresh = json.TryGetProperty("refresh_token", out var rt) ? rt.GetString()! : refreshToken;
        var newExpiry = json.GetProperty("expires_at").GetInt64();

        var cred = await db.StravaCredentials.FirstAsync(c => c.UserId == userId);
        await tokenService.SaveTokensAsync(userId, newAccess, newRefresh, newExpiry, cred.AthleteId, cred.AthleteName, cred.Scope);

        logger.LogInformation("Refreshed Strava token for user {UserId}", userId);
        return newAccess;
    }

    // ── Activity sync ────────────────────────────────────────────────────────

    public async Task<StravaSyncResult> SyncActivitiesAsync(Guid userId,
        int daysBack = 365, DateTimeOffset? afterDate = null, DateTimeOffset? beforeDate = null, long? sinceTimestamp = null)
    {
        var accessToken = await GetValidAccessTokenAsync(userId);

        var after = sinceTimestamp
            ?? afterDate?.ToUnixTimeSeconds()
            ?? DateTimeOffset.UtcNow.AddDays(-daysBack).ToUnixTimeSeconds();
        var before = beforeDate?.ToUnixTimeSeconds();

        int imported = 0, updated = 0, page = 1;

        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        while (true)
        {
            var url = $"https://www.strava.com/api/v3/athlete/activities?per_page=200&page={page}&after={after}";
            if (before.HasValue) url += $"&before={before}";

            var activitiesResponse = await http.GetAsync(url);
            if (!activitiesResponse.IsSuccessStatusCode)
            {
                var body = await activitiesResponse.Content.ReadAsStringAsync();
                logger.LogError("Strava activities API returned {Status} for user {UserId}: {Body}",
                    (int)activitiesResponse.StatusCode, userId, body);
                throw new HttpRequestException($"Strava API error {(int)activitiesResponse.StatusCode}: {body}");
            }
            var activities = await activitiesResponse.Content.ReadFromJsonAsync<JsonElement[]>() ?? [];
            if (activities.Length == 0) break;

            foreach (var a in activities)
            {
                var type = a.TryGetProperty("type", out var t) ? t.GetString() : null;
                if (type != "Run") continue;

                var distance = a.GetProperty("distance").GetDouble();
                if (distance < 3000) continue; // < 3km

                var stravaId = a.GetProperty("id").GetInt64().ToString();
                var existing = await db.StravaActivities.FirstOrDefaultAsync(x => x.StravaId == stravaId);

                if (existing is null)
                {
                    db.StravaActivities.Add(MapActivity(a, userId, stravaId));
                    imported++;
                }
                else
                {
                    UpdateActivity(existing, a);
                    updated++;
                }
            }

            await db.SaveChangesAsync();

            if (page % 10 == 0) await Task.Delay(10); // rate limit buffer
            if (activities.Length < 200) break;
            page++;
        }

        await tokenService.UpdateLastSyncedAtAsync(userId);
        return new StravaSyncResult(imported, updated);
    }

    public async Task SyncAllUsersAsync()
    {
        var userIds = await tokenService.GetAllConnectedUserIdsAsync();
        foreach (var userId in userIds)
        {
            try
            {
                var cred = await db.StravaCredentials.FirstAsync(c => c.UserId == userId);
                long? since = cred.LastSyncedAt.HasValue
                    ? new DateTimeOffset(cred.LastSyncedAt.Value).ToUnixTimeSeconds()
                    : null;

                await SyncActivitiesAsync(userId, sinceTimestamp: since);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Nightly sync failed for user {UserId}", userId);
            }
        }
    }

    // ── Pace calculation ────────────────────────────────────────────────────

    public async Task UpdateUserPacesByDistanceAsync(Guid userId)
    {
        var activities = await db.StravaActivities
            .Where(a => a.UserId == userId && a.Type == "Run"
                && a.Distance >= 3000 && a.Distance <= 30000)
            .OrderByDescending(a => a.StartDate)
            .Take(50)
            .ToListAsync();

        var user = await db.Users.FindAsync(userId);
        if (user is null) return;

        user.Pace5kMinPerKm = CalcPace(activities, 3000, 7000);
        user.Pace10kMinPerKm = CalcPace(activities, 8000, 12000);
        user.Pace15kMinPerKm = CalcPace(activities, 13000, 18000);
        user.PaceHalfMarathonMinPerKm = CalcPace(activities, 19000, 25000);
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
    }

    private static double? CalcPace(List<StravaActivity> activities, double minM, double maxM)
    {
        var filtered = activities
            .Where(a => a.Distance >= minM && a.Distance <= maxM)
            .Take(10)
            .ToList();

        if (filtered.Count == 0) return null;

        double weightSum = 0, paceSum = 0;
        for (int i = 0; i < filtered.Count; i++)
        {
            var weight = 1.0 - (0.5 * i / Math.Max(filtered.Count - 1, 1));
            var paceMinPerKm = filtered[i].MovingTime / 60.0 / (filtered[i].Distance / 1000.0);
            paceSum += paceMinPerKm * weight;
            weightSum += weight;
        }

        return paceSum / weightSum;
    }

    // ── Status & disconnect ──────────────────────────────────────────────────

    public async Task<StravaConnectionStatus> GetConnectionStatusAsync(Guid userId)
    {
        var cred = await db.StravaCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (cred is null) return new StravaConnectionStatus(false, null, null, null, null, null);
        return new StravaConnectionStatus(true, cred.AthleteId, cred.AthleteName, cred.Scope, cred.ExpiresAt, cred.LastSyncedAt);
    }

    public async Task DisconnectAsync(Guid userId)
    {
        await tokenService.DeleteAsync(userId);
    }

    // ── Activities listing ───────────────────────────────────────────────────

    public async Task<PaginatedActivitiesResponse> GetActivitiesAsync(Guid userId, int page = 1, int perPage = 20)
    {
        var query = db.StravaActivities.Where(a => a.UserId == userId);
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.StartDate)
            .Skip((page - 1) * perPage)
            .Take(perPage)
            .Select(a => MapActivityDto(a))
            .ToListAsync();

        return new PaginatedActivitiesResponse(items, total, page, perPage, (int)Math.Ceiling((double)total / perPage));
    }

    // ── Webhook ──────────────────────────────────────────────────────────────

    public object VerifyWebhookChallenge(string hubMode, string hubChallenge, string hubVerifyToken)
    {
        var expected = config["Strava:WebhookVerifyToken"];
        if (hubMode != "subscribe" || hubVerifyToken != expected)
            throw new UnauthorizedAccessException("Invalid webhook verification.");
        return new { hub_challenge = hubChallenge };
    }

    public async Task HandleWebhookEventAsync(JsonElement webhookEvent)
    {
        try
        {
            var objectType = webhookEvent.GetProperty("object_type").GetString();
            if (objectType != "activity") return;

            var aspectType = webhookEvent.GetProperty("aspect_type").GetString();
            var objectId = webhookEvent.GetProperty("object_id").GetInt64().ToString();
            var athleteId = webhookEvent.GetProperty("owner_id").GetInt64();

            var cred = await db.StravaCredentials.FirstOrDefaultAsync(c => c.AthleteId == athleteId);
            if (cred is null) return;

            var userId = cred.UserId;

            if (aspectType == "delete")
            {
                await db.StravaActivities.Where(a => a.StravaId == objectId).ExecuteDeleteAsync();
                return;
            }

            var accessToken = await GetValidAccessTokenAsync(userId);
            using var http = new HttpClient();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var activity = await http.GetFromJsonAsync<JsonElement>($"https://www.strava.com/api/v3/activities/{objectId}");

            var type = activity.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (type != "Run") return;

            var stravaId = activity.GetProperty("id").GetInt64().ToString();
            var existing = await db.StravaActivities.FirstOrDefaultAsync(x => x.StravaId == stravaId);

            if (existing is null)
                db.StravaActivities.Add(MapActivity(activity, userId, stravaId));
            else
                UpdateActivity(existing, activity);

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing Strava webhook event");
        }
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────

    private static StravaActivity MapActivity(JsonElement a, Guid userId, string stravaId) => new()
    {
        UserId = userId,
        StravaId = stravaId,
        Name = a.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
        Type = a.TryGetProperty("type", out var tp) ? tp.GetString() ?? "" : "",
        Distance = a.GetProperty("distance").GetDouble(),
        MovingTime = (int)a.GetProperty("moving_time").GetDouble(),
        ElapsedTime = (int)a.GetProperty("elapsed_time").GetDouble(),
        StartDate = a.GetProperty("start_date").GetDateTime(),
        AverageHeartrate = a.TryGetProperty("average_heartrate", out var ahr) && ahr.ValueKind != JsonValueKind.Null ? ahr.GetDouble() : null,
        MaxHeartrate = a.TryGetProperty("max_heartrate", out var mhr) && mhr.ValueKind != JsonValueKind.Null ? mhr.GetDouble() : null,
        AverageCadence = a.TryGetProperty("average_cadence", out var ac) && ac.ValueKind != JsonValueKind.Null ? ac.GetDouble() : null,
        SufferScore = a.TryGetProperty("suffer_score", out var ss) && ss.ValueKind != JsonValueKind.Null ? (int)ss.GetDouble() : null,
        RawJson = a.GetRawText()
    };

    private static void UpdateActivity(StravaActivity existing, JsonElement a)
    {
        existing.Name = a.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        existing.Distance = a.GetProperty("distance").GetDouble();
        existing.MovingTime = (int)a.GetProperty("moving_time").GetDouble();
        existing.ElapsedTime = (int)a.GetProperty("elapsed_time").GetDouble();
        existing.AverageHeartrate = a.TryGetProperty("average_heartrate", out var ahr) && ahr.ValueKind != JsonValueKind.Null ? ahr.GetDouble() : null;
        existing.MaxHeartrate = a.TryGetProperty("max_heartrate", out var mhr) && mhr.ValueKind != JsonValueKind.Null ? mhr.GetDouble() : null;
        existing.SufferScore = a.TryGetProperty("suffer_score", out var ss) && ss.ValueKind != JsonValueKind.Null ? (int)ss.GetDouble() : null;
        existing.RawJson = a.GetRawText();
        existing.UpdatedAt = DateTime.UtcNow;
    }

    public static StravaActivityDto MapActivityDto(StravaActivity a) => new(
        a.Id, a.UserId, a.StravaId, a.Name, a.Type, a.Distance, a.MovingTime,
        a.ElapsedTime, a.StartDate, a.AverageHeartrate, a.MaxHeartrate,
        a.AverageCadence, a.SufferScore, a.CreatedAt, a.UpdatedAt);
}
