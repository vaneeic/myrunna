using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.DTOs;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

public class TrainingPlansService(AppDbContext db, GoogleCalendarService calendarService, ILogger<TrainingPlansService> logger)
{
    // ── CRUD ─────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<TrainingPlanDto>> GetAllForUserAsync(Guid userId)
    {
        return await db.TrainingPlans
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => MapPlanDto(p))
            .ToListAsync();
    }

    public async Task<PlanDetailDto?> GetOneAsync(Guid planId, Guid userId)
    {
        var plan = await db.TrainingPlans
            .Include(p => p.Weeks).ThenInclude(w => w.Sessions)
            .Include(p => p.Races)
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId);

        if (plan is null) return null;

        var allSessions = plan.Weeks.SelectMany(w => w.Sessions).ToList();

        // Attach Strava activities where linked
        var stravaIds = allSessions
            .Where(s => s.StravaActivityId != null)
            .Select(s => s.StravaActivityId!)
            .ToList();

        var stravaActivities = stravaIds.Any()
            ? await db.StravaActivities
                .Where(a => a.UserId == userId && stravaIds.Contains(a.StravaId))
                .ToDictionaryAsync(a => a.StravaId)
            : new Dictionary<string, StravaActivity>();

        return new PlanDetailDto(
            plan.Id, plan.UserId, plan.Name, plan.GoalEvent, plan.GoalDate,
            plan.IsActive, plan.CurrentWeeklyVolumeKm, plan.RunsPerWeek,
            plan.EasyRunDay, plan.LongRunDay, plan.IntervalRunDay,
            plan.CreatedAt, plan.UpdatedAt,
            plan.Weeks.OrderBy(w => w.WeekNumber).Select(MapWeekDto),
            allSessions.Select(s => MapSessionDto(s, stravaActivities)),
            plan.Races.Select(MapRaceDto)
        );
    }

    public async Task<TrainingPlanDto> CreateAsync(Guid userId, CreatePlanRequest req)
    {
        var goalDate = DateOnly.Parse(req.GoalDate);
        var plan = new TrainingPlan
        {
            UserId = userId,
            Name = req.Name,
            GoalEvent = req.GoalEvent,
            GoalDate = goalDate,
            CurrentWeeklyVolumeKm = req.CurrentWeeklyVolumeKm,
            RunsPerWeek = req.RunsPerWeek,
            EasyRunDay = req.EasyRunDay,
            LongRunDay = req.LongRunDay,
            IntervalRunDay = req.IntervalRunDay
        };

        db.TrainingPlans.Add(plan);
        await db.SaveChangesAsync();

        await GenerateWeeksAsync(plan, userId);
        await db.SaveChangesAsync();

        // Fire-and-forget calendar sync
        _ = Task.Run(async () =>
        {
            try { await calendarService.SyncPlanToCalendarAsync(userId, plan.Id); }
            catch (Exception ex) { logger.LogError(ex, "Calendar sync failed for plan {PlanId}", plan.Id); }
        });

        return MapPlanDto(plan);
    }

    public async Task<TrainingPlanDto> SetActiveAsync(Guid planId, Guid userId)
    {
        await db.TrainingPlans
            .Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false));

        var plan = await db.TrainingPlans.FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new KeyNotFoundException("Plan not found.");

        plan.IsActive = true;
        plan.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return MapPlanDto(plan);
    }

    public async Task DeleteAsync(Guid planId, Guid userId)
    {
        var deleted = await db.TrainingPlans
            .Where(p => p.Id == planId && p.UserId == userId)
            .ExecuteDeleteAsync();

        if (deleted == 0) throw new KeyNotFoundException("Plan not found.");
    }

    public async Task<TrainingSessionDto> UpdateSessionAsync(Guid planId, Guid sessionId, Guid userId, UpdateSessionRequest req)
    {
        var session = await db.TrainingSessions
            .Include(s => s.Week)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.Week.Plan.UserId == userId && s.Week.PlanId == planId)
            ?? throw new KeyNotFoundException("Session not found.");

        if (req.Date is not null) session.Date = DateOnly.Parse(req.Date);
        if (req.SessionType is not null && Enum.TryParse<SessionType>(req.SessionType, out var st)) session.SessionType = st;
        if (req.Description is not null) session.Description = req.Description;
        if (req.PlannedDistanceKm.HasValue) session.PlannedDistanceKm = req.PlannedDistanceKm;
        if (req.PlannedDurationMin.HasValue) session.PlannedDurationMin = req.PlannedDurationMin;
        if (req.Completed.HasValue) session.Completed = req.Completed.Value;
        if (req.Skipped.HasValue) session.Skipped = req.Skipped.Value;
        if (req.StravaActivityId is not null) session.StravaActivityId = req.StravaActivityId == "" ? null : req.StravaActivityId;
        session.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return MapSessionDto(session, []);
    }

    // ── Plan generation ───────────────────────────────────────────────────────

    private async Task GenerateWeeksAsync(TrainingPlan plan, Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var totalWeeks = (int)Math.Ceiling((plan.GoalDate.ToDateTime(TimeOnly.MinValue) - today.ToDateTime(TimeOnly.MinValue)).TotalDays / 7);
        totalWeeks = Math.Max(totalWeeks, 1);

        double weeklyVolume = plan.CurrentWeeklyVolumeKm;

        for (int i = 0; i < totalWeeks; i++)
        {
            var weekStart = today.AddDays(i * 7);
            var isTaper = i >= totalWeeks - 2;
            var isCutback = !isTaper && (i + 1) % 4 == 0;
            var focus = GetWeekFocus(i, totalWeeks, isTaper, isCutback);

            double vol = isTaper
                ? (i == totalWeeks - 2 ? weeklyVolume * 0.5 : weeklyVolume * 0.3)
                : isCutback
                    ? weeklyVolume * 0.7
                    : weeklyVolume;

            var week = new TrainingWeek
            {
                PlanId = plan.Id,
                WeekNumber = i + 1,
                StartDate = weekStart,
                Focus = focus,
                WeeklyVolumeKm = Math.Round(vol, 1),
                IsTaperWeek = isTaper,
                IsCutbackWeek = isCutback
            };
            db.TrainingWeeks.Add(week);

            GenerateSessions(week, vol, plan, user, isTaper);

            if (!isTaper && !isCutback)
            {
                var increase = Math.Min(weeklyVolume * 0.1, 5.0);
                weeklyVolume += increase;
            }
        }
    }

    private void GenerateSessions(TrainingWeek week, double volumeKm, TrainingPlan plan, User? user, bool isTaper)
    {
        if (isTaper)
        {
            AddSession(week, plan.EasyRunDay ?? 1, SessionType.easy_run, volumeKm * 0.20, user, "Shakeout run");
            AddSession(week, plan.IntervalRunDay ?? 2, SessionType.tempo, volumeKm * 0.15, user, "Light tempo");
            AddSession(week, plan.LongRunDay ?? 5, SessionType.easy_run, volumeKm * 0.15, user, "Easy shakeout");
            AddSession(week, (plan.LongRunDay ?? 5) + 1, SessionType.race, null, user, plan.GoalEvent, isRest: false);
            return;
        }

        if (plan.RunsPerWeek >= 4)
        {
            AddSession(week, plan.EasyRunDay ?? 1, SessionType.easy_run, volumeKm * 0.25, user, "Easy aerobic run");
            AddSession(week, plan.IntervalRunDay ?? 2, SessionType.tempo, volumeKm * 0.20, user, "Tempo run");
            AddSession(week, plan.LongRunDay ?? 5, SessionType.long_run, volumeKm * 0.40, user, "Long run");
            AddSession(week, (plan.LongRunDay ?? 5) + 1, SessionType.recovery, volumeKm * 0.15, user, "Recovery run");
        }
        else
        {
            AddSession(week, plan.EasyRunDay ?? 1, SessionType.easy_run, volumeKm * 0.30, user, "Easy aerobic run");
            AddSession(week, plan.IntervalRunDay ?? 3, SessionType.intervals, volumeKm * 0.25, user, "Interval training");
            AddSession(week, plan.LongRunDay ?? 5, SessionType.long_run, volumeKm * 0.45, user, "Long run");
        }
    }

    private void AddSession(TrainingWeek week, int dayOfWeek, SessionType type, double? distanceKm, User? user, string description, bool isRest = false)
    {
        var weekStartDay = (int)week.StartDate.DayOfWeek;
        var daysToAdd = dayOfWeek - weekStartDay;
        if (daysToAdd < 0) daysToAdd += 7;
        var date = week.StartDate.AddDays(daysToAdd);

        int? duration = null;
        if (distanceKm.HasValue && user is not null)
        {
            var pace = GetPaceForDistance(user, distanceKm.Value);
            if (pace.HasValue)
            {
                var multiplier = type switch
                {
                    SessionType.easy_run => 1.1,
                    SessionType.long_run => 1.0,
                    SessionType.tempo => 0.9,
                    SessionType.intervals => 0.8,
                    SessionType.recovery => 1.15,
                    _ => 1.0
                };
                duration = (int)Math.Round(distanceKm.Value * pace.Value * multiplier);
            }
        }

        db.TrainingSessions.Add(new TrainingSession
        {
            WeekId = week.Id,
            Date = date,
            SessionType = type,
            Description = description,
            PlannedDistanceKm = distanceKm.HasValue ? Math.Round(distanceKm.Value, 1) : null,
            PlannedDurationMin = duration
        });
    }

    private static double? GetPaceForDistance(User user, double distanceKm) => distanceKm switch
    {
        <= 7 => user.Pace5kMinPerKm ?? user.Pace10kMinPerKm ?? user.Pace15kMinPerKm ?? user.PaceHalfMarathonMinPerKm,
        <= 12 => user.Pace10kMinPerKm ?? user.Pace5kMinPerKm ?? user.Pace15kMinPerKm ?? user.PaceHalfMarathonMinPerKm,
        <= 18 => user.Pace15kMinPerKm ?? user.Pace10kMinPerKm ?? user.PaceHalfMarathonMinPerKm ?? user.Pace5kMinPerKm,
        _ => user.PaceHalfMarathonMinPerKm ?? user.Pace15kMinPerKm ?? user.Pace10kMinPerKm ?? user.Pace5kMinPerKm
    };

    private static string GetWeekFocus(int index, int total, bool isTaper, bool isCutback)
    {
        if (isTaper) return "Taper";
        if (isCutback) return "Recovery week";
        var pct = (double)index / total;
        return pct < 0.33 ? "Base building" : pct < 0.66 ? "Build phase" : "Peak training";
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private static TrainingPlanDto MapPlanDto(TrainingPlan p) => new(
        p.Id, p.UserId, p.Name, p.GoalEvent, p.GoalDate, p.IsActive,
        p.CurrentWeeklyVolumeKm, p.RunsPerWeek, p.EasyRunDay, p.LongRunDay,
        p.IntervalRunDay, p.CreatedAt, p.UpdatedAt);

    private static TrainingWeekDto MapWeekDto(TrainingWeek w) => new(
        w.Id, w.PlanId, w.WeekNumber, w.StartDate, w.Focus,
        w.WeeklyVolumeKm, w.IsTaperWeek, w.IsCutbackWeek, w.CreatedAt);

    private static TrainingSessionDto MapSessionDto(TrainingSession s, Dictionary<string, StravaActivity> activities)
    {
        StravaActivityDto? stravaDto = null;
        if (s.StravaActivityId is not null && activities.TryGetValue(s.StravaActivityId, out var sa))
            stravaDto = StravaService.MapActivityDto(sa);

        return new TrainingSessionDto(
            s.Id, s.WeekId, s.Date, s.SessionType.ToString(), s.Description,
            s.PlannedDistanceKm, s.PlannedDurationMin, s.Completed, s.Skipped,
            s.StravaActivityId, stravaDto, s.CreatedAt, s.UpdatedAt);
    }

    private static RaceDto MapRaceDto(Race r) => new(
        r.Id, r.PlanId, r.Name, r.Date, r.DistanceKm, r.Type.ToString(), r.Location, r.Approach, r.CreatedAt);

    // ── Race management ───────────────────────────────────────────────────────

    public async Task<RaceDto> AddRaceAsync(Guid planId, Guid userId, CreateRaceRequest req)
    {
        var exists = await db.TrainingPlans.AnyAsync(p => p.Id == planId && p.UserId == userId);
        if (!exists) throw new KeyNotFoundException("Plan not found.");

        var race = new Race
        {
            PlanId = planId,
            Name = req.Name,
            Date = DateOnly.Parse(req.Date),
            DistanceKm = req.DistanceKm,
            Type = RaceType.B,
            Location = req.Location,
            Approach = req.Approach
        };
        db.Races.Add(race);
        await db.SaveChangesAsync();
        return MapRaceDto(race);
    }

    public async Task<RaceDto> UpdateRaceAsync(Guid planId, Guid raceId, Guid userId, UpdateRaceRequest req)
    {
        var race = await db.Races
            .Include(r => r.Plan)
            .FirstOrDefaultAsync(r => r.Id == raceId && r.PlanId == planId && r.Plan.UserId == userId)
            ?? throw new KeyNotFoundException("Race not found.");

        if (req.Name is not null) race.Name = req.Name;
        if (req.Date is not null) race.Date = DateOnly.Parse(req.Date);
        if (req.DistanceKm.HasValue) race.DistanceKm = req.DistanceKm.Value;
        if (req.Location is not null) race.Location = req.Location;
        if (req.Approach is not null) race.Approach = req.Approach;

        await db.SaveChangesAsync();
        return MapRaceDto(race);
    }

    public async Task DeleteRaceAsync(Guid planId, Guid raceId, Guid userId)
    {
        var deleted = await db.Races
            .Where(r => r.Id == raceId && r.PlanId == planId && r.Plan.UserId == userId)
            .ExecuteDeleteAsync();

        if (deleted == 0) throw new KeyNotFoundException("Race not found.");
    }
}
