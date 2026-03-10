using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyRunna.Api.Services;

namespace MyRunna.Api.Controllers;

[ApiController]
[Route("api/google-calendar")]
public class GoogleCalendarController(GoogleCalendarService googleCalendarService, IConfiguration config) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    private readonly string _frontendUrl = config["App:FrontendUrl"] ?? "http://localhost:4200";

    [Authorize]
    [HttpGet("connect")]
    public IActionResult Connect()
        => Ok(new { url = googleCalendarService.GetAuthorizationUrlSimple(UserId) });

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        if (error is not null || code is null || state is null)
            return Redirect($"{_frontendUrl}/settings?gcal=denied");

        if (!Guid.TryParse(state, out var userId))
            return Redirect($"{_frontendUrl}/settings?gcal=error");

        try
        {
            await googleCalendarService.ConnectUserAsync(userId, code);
            return Redirect($"{_frontendUrl}/settings?gcal=connected");
        }
        catch (Exception)
        {
            return Redirect($"{_frontendUrl}/settings?gcal=error");
        }
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
        => Ok(await googleCalendarService.GetStatusAsync(UserId));

    [Authorize]
    [HttpDelete("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        await googleCalendarService.DisconnectAsync(UserId);
        return Ok(new { message = "Google Calendar disconnected." });
    }
}
