using Microsoft.AspNetCore.Mvc;

namespace MyRunna.Api.Controllers;

[ApiController]
public class HealthController : ControllerBase
{
    [HttpGet("/health")]
    public IActionResult Health()
        => Ok(new { status = "ok", timestamp = DateTime.UtcNow, service = "myrunna-api" });

    [HttpGet("/api")]
    public IActionResult Root()
        => Redirect("/scalar/v1");
}
