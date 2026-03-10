using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyRunna.Api.DTOs;
using MyRunna.Api.Services;

namespace MyRunna.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UsersService usersService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await usersService.GetByIdAsync(UserId);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPatch("me")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        try
        {
            var user = await usersService.UpdateProfileAsync(UserId, req);
            return Ok(user);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPatch("me/paces")]
    public async Task<IActionResult> UpdatePaces([FromBody] UpdatePacesRequest req)
    {
        try
        {
            var user = await usersService.UpdatePacesAsync(UserId, req);
            return Ok(user);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
