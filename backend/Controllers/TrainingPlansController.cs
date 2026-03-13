using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyRunna.Api.DTOs;
using MyRunna.Api.Services;

namespace MyRunna.Api.Controllers;

[ApiController]
[Route("api/training-plans")]
[Authorize]
public class TrainingPlansController(TrainingPlansService plansService, ILogger<TrainingPlansController> logger) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await plansService.GetAllForUserAsync(UserId));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id)
    {
        var plan = await plansService.GetOneAsync(id, UserId);
        return plan is null ? NotFound() : Ok(plan);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePlanRequest req)
    {
        try
        {
            var plan = await plansService.CreateAsync(UserId, req);
            return CreatedAtAction(nameof(GetOne), new { id = plan.Id }, plan);
        }
        catch (Exception ex)
        {
            var inner = ex.InnerException;
            logger.LogError(ex, "Failed to create plan for user {UserId}", UserId);
            return BadRequest(new {
                message = ex.Message,
                inner = inner?.Message,
                type = ex.GetType().FullName,
                innerType = inner?.GetType().FullName,
                trace = ex.StackTrace
            });
        }
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id)
    {
        try
        {
            var plan = await plansService.SetActiveAsync(id, UserId);
            return Ok(plan);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await plansService.DeleteAsync(id, UserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{id:guid}/races")]
    public async Task<IActionResult> AddRace(Guid id, [FromBody] CreateRaceRequest req)
    {
        try
        {
            var race = await plansService.AddRaceAsync(id, UserId, req);
            return Ok(race);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPatch("{id:guid}/races/{raceId:guid}")]
    public async Task<IActionResult> UpdateRace(Guid id, Guid raceId, [FromBody] UpdateRaceRequest req)
    {
        try
        {
            var race = await plansService.UpdateRaceAsync(id, raceId, UserId, req);
            return Ok(race);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}/races/{raceId:guid}")]
    public async Task<IActionResult> DeleteRace(Guid id, Guid raceId)
    {
        try
        {
            await plansService.DeleteRaceAsync(id, raceId, UserId);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPatch("{id:guid}/sessions/{sessionId:guid}")]
    public async Task<IActionResult> UpdateSession(Guid id, Guid sessionId, [FromBody] UpdateSessionRequest req)
    {
        try
        {
            var session = await plansService.UpdateSessionAsync(id, sessionId, UserId, req);
            return Ok(session);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
