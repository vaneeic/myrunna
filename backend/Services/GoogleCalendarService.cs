using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.DTOs;
using MyRunna.Api.Models;
using GoogleOAuth2Credential = Google.Apis.Auth.OAuth2.GoogleCredential;

namespace MyRunna.Api.Services;

public class GoogleCalendarService(AppDbContext db, IConfiguration config, ILogger<GoogleCalendarService> logger)
{
    private readonly string _clientId = config["Google:ClientId"] ?? "";
    private readonly string _clientSecret = config["Google:ClientSecret"] ?? "";
    private readonly string _redirectUri = config["Google:RedirectUri"] ?? "";
    private readonly string _frontendUrl = config["App:FrontendUrl"] ?? "http://localhost:4200";

    private TokenEncryptionService Encryption => new(
        config["Google:TokenEncryptionKey"] ?? config["Strava:TokenEncryptionKey"]
            ?? throw new InvalidOperationException("Token encryption key not configured."));

    // ── OAuth ────────────────────────────────────────────────────────────────

    public string GetAuthorizationUrl(Guid userId)
    {
        var flow = CreateFlow();
        return flow.CreateAuthorizationCodeRequest(_redirectUri).Build().ToString()
            .Replace("redirect_uri=", $"state={userId}&redirect_uri=");
        // Note: simpler approach below
    }

    public string GetAuthorizationUrlSimple(Guid userId)
    {
        return $"https://accounts.google.com/o/oauth2/v2/auth" +
               $"?client_id={_clientId}" +
               $"&redirect_uri={Uri.EscapeDataString(_redirectUri)}" +
               $"&response_type=code" +
               $"&scope={Uri.EscapeDataString("https://www.googleapis.com/auth/calendar")}" +
               $"&access_type=offline" +
               $"&prompt=consent" +
               $"&state={userId}";
    }

    public async Task ConnectUserAsync(Guid userId, string code)
    {
        using var http = new HttpClient();
        var response = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId,
            ["client_secret"] = _clientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = _redirectUri
        }));

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();

        var accessToken = json.GetProperty("access_token").GetString()!;
        var refreshToken = json.GetProperty("refresh_token").GetString()!;
        var expiresIn = json.GetProperty("expires_in").GetInt32();
        var expiresAt = DateTime.UtcNow.AddSeconds(expiresIn);

        // Create/find MyRunna calendar
        var calendarId = await EnsureMyRunnaCalendarAsync(accessToken);

        // Save credentials
        var existing = await db.GoogleCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (existing is not null)
        {
            existing.EncryptedAccessToken = Encryption.Encrypt(accessToken);
            existing.EncryptedRefreshToken = Encryption.Encrypt(refreshToken);
            existing.TokenExpiresAt = expiresAt;
            existing.CalendarId = calendarId;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.GoogleCredentials.Add(new Models.GoogleCredential
            {
                UserId = userId,
                EncryptedAccessToken = Encryption.Encrypt(accessToken),
                EncryptedRefreshToken = Encryption.Encrypt(refreshToken),
                TokenExpiresAt = expiresAt,
                CalendarId = calendarId
            });
        }
        await db.SaveChangesAsync();
    }

    // ── Status & disconnect ──────────────────────────────────────────────────

    public async Task<GoogleCalendarStatus> GetStatusAsync(Guid userId)
    {
        var cred = await db.GoogleCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (cred is null) return new GoogleCalendarStatus(false, null, null, null);
        return new GoogleCalendarStatus(true, "MyRunna", cred.CalendarId, cred.LastSyncedAt);
    }

    public async Task DisconnectAsync(Guid userId)
    {
        var cred = await db.GoogleCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (cred is null) return;

        try
        {
            var accessToken = Encryption.Decrypt(cred.EncryptedAccessToken);
            using var http = new HttpClient();
            await http.PostAsync($"https://oauth2.googleapis.com/revoke?token={Uri.EscapeDataString(accessToken)}", null);

            var calendarService = BuildCalendarService(accessToken);
            await calendarService.Calendars.Delete(cred.CalendarId).ExecuteAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Non-fatal error during Google Calendar disconnect for user {UserId}", userId);
        }

        await db.GoogleCredentials.Where(c => c.UserId == userId).ExecuteDeleteAsync();
    }

    // ── Calendar sync ────────────────────────────────────────────────────────

    public async Task SyncPlanToCalendarAsync(Guid userId, Guid planId)
    {
        var cred = await db.GoogleCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (cred is null) return; // silently skip if not connected

        try
        {
            var accessToken = await EnsureFreshTokenAsync(cred);
            var calendarService = BuildCalendarService(accessToken);

            var plan = await db.TrainingPlans
                .Include(p => p.Weeks).ThenInclude(w => w.Sessions)
                .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId);

            if (plan is null) return;

            foreach (var session in plan.Weeks.SelectMany(w => w.Sessions))
            {
                var evt = new Event
                {
                    Summary = $"{FormatSessionType(session.SessionType)} – {plan.Name}",
                    Start = new EventDateTime { Date = session.Date.ToString("yyyy-MM-dd") },
                    End = new EventDateTime { Date = session.Date.ToString("yyyy-MM-dd") },
                    Description = session.Description,
                    ColorId = GetSessionColor(session.SessionType),
                    ExtendedProperties = new Event.ExtendedPropertiesData
                    {
                        Private__ = new Dictionary<string, string>
                        {
                            ["myrunnaSessionId"] = session.Id.ToString(),
                            ["myrunnaPlanId"] = plan.Id.ToString()
                        }
                    }
                };
                await calendarService.Events.Insert(evt, cred.CalendarId).ExecuteAsync();
            }

            await db.GoogleCredentials
                .Where(c => c.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.LastSyncedAt, DateTime.UtcNow));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Calendar sync failed for user {UserId}, plan {PlanId}", userId, planId);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<string> EnsureFreshTokenAsync(Models.GoogleCredential cred)
    {
        if (cred.TokenExpiresAt > DateTime.UtcNow.AddMinutes(1))
            return Encryption.Decrypt(cred.EncryptedAccessToken);

        var refreshToken = Encryption.Decrypt(cred.EncryptedRefreshToken);
        using var http = new HttpClient();
        var response = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _clientId,
            ["client_secret"] = _clientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token"
        }));
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();

        var newAccess = json.GetProperty("access_token").GetString()!;
        var expiresIn = json.GetProperty("expires_in").GetInt32();
        cred.EncryptedAccessToken = Encryption.Encrypt(newAccess);
        cred.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn);
        cred.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return newAccess;
    }

    private async Task<string> EnsureMyRunnaCalendarAsync(string accessToken)
    {
        var service = BuildCalendarService(accessToken);
        var list = await service.CalendarList.List().ExecuteAsync();
        var existing = list.Items?.FirstOrDefault(c => c.Summary == "MyRunna");
        if (existing is not null) return existing.Id;

        var newCal = await service.Calendars.Insert(new Calendar { Summary = "MyRunna" }).ExecuteAsync();
        return newCal.Id;
    }

    private CalendarService BuildCalendarService(string accessToken) =>
        new(new BaseClientService.Initializer
        {
            HttpClientInitializer = GoogleOAuth2Credential.FromAccessToken(accessToken),
            ApplicationName = "MyRunna"
        });

    private GoogleAuthorizationCodeFlow CreateFlow() =>
        new(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets { ClientId = _clientId, ClientSecret = _clientSecret },
            Scopes = ["https://www.googleapis.com/auth/calendar"]
        });

    private static string FormatSessionType(SessionType t) => t switch
    {
        SessionType.easy_run => "Easy Run",
        SessionType.long_run => "Long Run",
        SessionType.tempo => "Tempo",
        SessionType.intervals => "Intervals",
        SessionType.recovery => "Recovery",
        SessionType.race => "Race",
        SessionType.rest => "Rest",
        _ => t.ToString()
    };

    private static string GetSessionColor(SessionType t) => t switch
    {
        SessionType.long_run => "2",
        SessionType.easy_run => "7",
        SessionType.tempo => "5",
        SessionType.intervals => "9",
        SessionType.recovery => "10",
        SessionType.race => "6",
        _ => "11"
    };
}
