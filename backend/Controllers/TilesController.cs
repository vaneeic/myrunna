using Microsoft.AspNetCore.Mvc;

namespace MyRunna.Api.Controllers;

/// <summary>
/// Proxies map tiles from OpenStreetMap so the frontend canvas can draw them
/// without CORS issues. Tiles are cached in memory for the lifetime of the process.
/// </summary>
[ApiController]
[Route("api/tiles")]
public class TilesController : ControllerBase
{
    private static readonly Dictionary<string, byte[]> _cache = new();
    private static readonly SemaphoreSlim _lock = new(1, 1);

    private readonly IHttpClientFactory _http;

    public TilesController(IHttpClientFactory http) => _http = http;

    [HttpGet("{z:int}/{x:int}/{y:int}")]
    public async Task<IActionResult> GetTile(int z, int x, int y)
    {
        if (z is < 0 or > 19) return BadRequest();

        var key = $"{z}/{x}/{y}";

        // Return cached tile
        if (_cache.TryGetValue(key, out var cached))
            return File(cached, "image/png");

        await _lock.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (_cache.TryGetValue(key, out cached))
                return File(cached, "image/png");

            var client = _http.CreateClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("MyRunna/1.0 tile-proxy (+https://github.com/icvanee/myrunna)");
            client.Timeout = TimeSpan.FromSeconds(10);

            var url = $"https://tile.openstreetmap.org/{z}/{x}/{y}.png";
            var resp = await client.GetAsync(url);

            if (!resp.IsSuccessStatusCode)
                return NotFound();

            var bytes = await resp.Content.ReadAsByteArrayAsync();

            // Keep cache bounded
            if (_cache.Count < 2000)
                _cache[key] = bytes;

            return File(bytes, "image/png");
        }
        catch
        {
            return NotFound();
        }
        finally
        {
            _lock.Release();
        }
    }
}
