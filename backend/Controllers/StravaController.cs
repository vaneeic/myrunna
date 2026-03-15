using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyRunna.Api.Services;

namespace MyRunna.Api.Controllers;

[ApiController]
[Route("api/strava")]
public class StravaController(StravaService stravaService, IConfiguration config, ILogger<StravaController> logger) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    private readonly string _frontendUrl = config["App:FrontendUrl"] ?? "http://localhost:4200";

    // ── OAuth ────────────────────────────────────────────────────────────────

    [Authorize]
    [HttpGet("connect")]
    public IActionResult Connect()
        => Ok(new { url = stravaService.GetAuthorizationUrl(UserId) });

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, [FromQuery] string? scope)
    {
        if (error is not null || code is null || state is null)
            return Redirect($"{_frontendUrl}/settings?strava=denied");

        if (!Guid.TryParse(state, out var userId))
            return Redirect($"{_frontendUrl}/settings?strava=error");

        try
        {
            await stravaService.ExchangeCodeForTokensAsync(code, userId, scope);
            return Redirect($"{_frontendUrl}/settings?strava=connected");
        }
        catch (Exception)
        {
            return Redirect($"{_frontendUrl}/settings?strava=error");
        }
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
        => Ok(await stravaService.GetConnectionStatusAsync(UserId));

    [Authorize]
    [HttpDelete("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        await stravaService.DisconnectAsync(UserId);
        return Ok(new { message = "Strava disconnected." });
    }

    // ── Sync ─────────────────────────────────────────────────────────────────

    [Authorize]
    [HttpPost("sync")]
    public async Task<IActionResult> Sync(
        [FromQuery] int daysBack = 365,
        [FromQuery] DateTime? afterDate = null,
        [FromQuery] DateTime? beforeDate = null)
    {
        try
        {
            var result = await stravaService.SyncActivitiesAsync(UserId, daysBack,
                afterDate.HasValue ? new DateTimeOffset(afterDate.Value) : null,
                beforeDate.HasValue ? new DateTimeOffset(beforeDate.Value) : null);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Strava sync failed for user {UserId}", UserId);
            return StatusCode(500, new { message = ex.Message, type = ex.GetType().FullName, trace = ex.StackTrace });
        }
    }

    [Authorize]
    [HttpPost("recalculate-paces")]
    public async Task<IActionResult> RecalculatePaces()
    {
        await stravaService.UpdateUserPacesByDistanceAsync(UserId);
        return Ok(new { message = "Paces recalculated." });
    }

    [Authorize]
    [HttpGet("activities")]
    public async Task<IActionResult> GetActivities([FromQuery] int page = 1, [FromQuery] int perPage = 20)
        => Ok(await stravaService.GetActivitiesAsync(UserId, page, perPage));

    [Authorize]
    [HttpGet("activities/{id:guid}")]
    public async Task<IActionResult> GetActivity(Guid id)
    {
        var activity = await stravaService.GetActivityAsync(UserId, id);
        if (activity is null) return NotFound(new { message = "Activity not found." });
        return Ok(activity);
    }

    // ── Webhook ──────────────────────────────────────────────────────────────

    [HttpGet("webhook")]
    public IActionResult WebhookVerify(
        [FromQuery(Name = "hub.mode")] string hubMode,
        [FromQuery(Name = "hub.challenge")] string hubChallenge,
        [FromQuery(Name = "hub.verify_token")] string hubVerifyToken)
    {
        try
        {
            var result = stravaService.VerifyWebhookChallenge(hubMode, hubChallenge, hubVerifyToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("webhook")]
    public IActionResult WebhookEvent([FromBody] JsonElement payload)
    {
        // Fire-and-forget, always return 200 immediately
        _ = Task.Run(() => stravaService.HandleWebhookEventAsync(payload));
        return Ok(new { received = true });
    }
}
