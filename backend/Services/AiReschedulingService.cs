using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

public record SessionModification(
    Guid SessionId,
    double? PlannedDistanceKm,
    string? SessionType,
    string? Description);

public class AiReschedulingService(
    AppDbContext db,
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    ILogger<AiReschedulingService> logger)
{
    private const string AnthropicUrl = "https://api.anthropic.com/v1/messages";

    public async Task<List<SessionModification>> GetModificationsAsync(Guid planId, Race bRace)
    {
        var apiKey = config["Anthropic:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.");

        var allWeeks = await db.TrainingWeeks
            .Where(w => w.PlanId == planId)
            .Include(w => w.Sessions)
            .OrderBy(w => w.WeekNumber)
            .ToListAsync();

        var bRaceDate = bRace.Date;
        var bRaceWeek = allWeeks.FirstOrDefault(w =>
            w.StartDate <= bRaceDate && w.StartDate.AddDays(6) >= bRaceDate)
            ?? throw new InvalidOperationException("B-race date falls outside the plan's training weeks.");

        var preWeek = allWeeks.FirstOrDefault(w => w.WeekNumber == bRaceWeek.WeekNumber - 1);
        var postWeek = allWeeks.FirstOrDefault(w => w.WeekNumber == bRaceWeek.WeekNumber + 1);

        var prompt = BuildPrompt(bRace, preWeek, bRaceWeek, postWeek);

        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("x-api-key", apiKey);
        client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var requestBody = new
        {
            model = "claude-sonnet-4-6",
            max_tokens = 2048,
            system = "You are an expert running coach AI. When asked to adjust a training plan around a B-race, respond ONLY with valid JSON — no preamble, no markdown, no explanation.",
            messages = new[] { new { role = "user", content = prompt } }
        };

        var response = await client.PostAsJsonAsync(AnthropicUrl, requestBody);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Claude API error {Status}: {Body}", (int)response.StatusCode, body);
            throw new HttpRequestException($"AI service returned {(int)response.StatusCode}");
        }

        var envelope = JsonDocument.Parse(body);
        var text = envelope.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";

        var startIdx = text.IndexOf('{');
        var endIdx = text.LastIndexOf('}');
        if (startIdx < 0 || endIdx < 0)
            throw new InvalidOperationException("AI returned an unexpected response format.");

        var parsed = JsonDocument.Parse(text[startIdx..(endIdx + 1)]);
        var modifications = new List<SessionModification>();

        if (parsed.RootElement.TryGetProperty("modifications", out var mods))
        {
            foreach (var mod in mods.EnumerateArray())
            {
                if (!mod.TryGetProperty("sessionId", out var idEl)) continue;
                if (!Guid.TryParse(idEl.GetString(), out var sid)) continue;

                double? dist = mod.TryGetProperty("plannedDistanceKm", out var d) && d.ValueKind == JsonValueKind.Number
                    ? d.GetDouble() : null;
                string? st = mod.TryGetProperty("sessionType", out var s) ? s.GetString() : null;
                string? desc = mod.TryGetProperty("description", out var dsc) ? dsc.GetString() : null;

                modifications.Add(new SessionModification(sid, dist, st, desc));
            }
        }

        logger.LogInformation("AI produced {Count} session modifications for B-race {RaceId}", modifications.Count, bRace.Id);
        return modifications;
    }

    private static string BuildPrompt(Race bRace, TrainingWeek? preWeek, TrainingWeek bRaceWeek, TrainingWeek? postWeek)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"B-race: \"{bRace.Name}\" — {bRace.DistanceKm} km on {bRace.Date:yyyy-MM-dd}");
        sb.AppendLine($"Approach: \"{bRace.Approach ?? "Strong and steady"}\"");
        sb.AppendLine();

        void AppendWeek(string label, TrainingWeek week)
        {
            sb.AppendLine($"{label} (Week {week.WeekNumber}, starts {week.StartDate:yyyy-MM-dd}, planned volume {week.WeeklyVolumeKm} km):");
            foreach (var s in week.Sessions.OrderBy(x => x.Date))
            {
                sb.AppendLine($"  {{\"sessionId\":\"{s.Id}\",\"date\":\"{s.Date:yyyy-MM-dd}\",\"sessionType\":\"{s.SessionType}\",\"plannedDistanceKm\":{(s.PlannedDistanceKm.HasValue ? s.PlannedDistanceKm.Value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) : "null")},\"description\":\"{s.Description}\"}}");
            }
        }

        if (preWeek is not null) AppendWeek("PRE B-RACE WEEK", preWeek);
        sb.AppendLine();
        AppendWeek("B-RACE WEEK", bRaceWeek);
        sb.AppendLine();
        if (postWeek is not null) AppendWeek("POST B-RACE WEEK", postWeek);

        sb.AppendLine();
        sb.AppendLine("Approach-specific rules:");
        sb.AppendLine("'Relaxed effort': Keep sessions mostly unchanged. The session closest to the race date in B-race week should become a race session.");
        sb.AppendLine("'Strong and steady': Pre-week reduce distances ~20%, replace any tempo/intervals with easy_run. B-race week: session on race date becomes race, other sessions reduced ~20%. Post-week: all easy_run or recovery, distances reduced ~20%.");
        sb.AppendLine("'Go all out': Pre-week reduce ~30%, replace all hard sessions with easy_run. B-race week: session on race date becomes race, all other sessions become easy_run or recovery at reduced distance. Post-week: all recovery runs, distances reduced ~40%.");
        sb.AppendLine();
        sb.AppendLine("Return ALL sessions across all provided weeks. Modify only what the approach requires.");
        sb.AppendLine("Valid sessionType values: easy_run, long_run, tempo, intervals, recovery, race, rest");
        sb.AppendLine();
        sb.AppendLine("Respond with exactly this JSON structure:");
        sb.AppendLine("{\"modifications\":[{\"sessionId\":\"<exact uuid from above>\",\"plannedDistanceKm\":<number>,\"sessionType\":\"<type>\",\"description\":\"<short description>\"}]}");

        return sb.ToString();
    }
}
