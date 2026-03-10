using MyRunna.Api.Services;

namespace MyRunna.Api.Services;

/// <summary>
/// Hosted service that runs nightly Strava sync at 02:00 UTC.
/// </summary>
public class StravaSyncScheduler(IServiceProvider services, ILogger<StravaSyncScheduler> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = now.Date.AddDays(now.Hour >= 2 ? 1 : 0).AddHours(2);
            var delay = nextRun - now;

            logger.LogInformation("Next Strava nightly sync at {NextRun} UTC (in {Delay})", nextRun, delay);
            await Task.Delay(delay, stoppingToken);

            if (stoppingToken.IsCancellationRequested) break;

            logger.LogInformation("Starting nightly Strava sync...");
            try
            {
                using var scope = services.CreateScope();
                var stravaService = scope.ServiceProvider.GetRequiredService<StravaService>();
                await stravaService.SyncAllUsersAsync();
                logger.LogInformation("Nightly Strava sync completed.");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Nightly Strava sync failed.");
            }
        }
    }
}
