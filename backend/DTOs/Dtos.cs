using System.ComponentModel.DataAnnotations;

namespace MyRunna.Api.DTOs;

// Auth
public record RegisterRequest(
    [Required][EmailAddress] string Email,
    [Required][MinLength(8)] string Password,
    [Required][MinLength(2)][MaxLength(100)] string DisplayName);

public record LoginRequest(
    [Required][EmailAddress] string Email,
    [Required][MinLength(8)] string Password);

public record AuthResponse(string AccessToken, UserDto User);

// User
public record UserDto(Guid Id, string Email, string DisplayName, DateTime CreatedAt,
    double? Pace5kMinPerKm, double? Pace10kMinPerKm, double? Pace15kMinPerKm, double? PaceHalfMarathonMinPerKm);

public record UpdateProfileRequest([MinLength(2)][MaxLength(100)] string? DisplayName);

public record UpdatePacesRequest(
    [Range(3, double.MaxValue)] double? Pace5kMinPerKm,
    [Range(3, double.MaxValue)] double? Pace10kMinPerKm,
    [Range(3, double.MaxValue)] double? Pace15kMinPerKm,
    [Range(3, double.MaxValue)] double? PaceHalfMarathonMinPerKm);

// Strava
public record StravaConnectionStatus(bool Connected, long? AthleteId, string? AthleteName,
    string? Scope, long? ExpiresAt, DateTime? LastSyncedAt);

public record StravaSyncResult(int Imported, int Updated);

public record StravaActivityDto(Guid Id, Guid UserId, string StravaId, string Name, string Type,
    double Distance, int MovingTime, int ElapsedTime, DateTime StartDate,
    double? AverageHeartrate, double? MaxHeartrate, double? AverageCadence, int? SufferScore,
    DateTime CreatedAt, DateTime UpdatedAt);

public record PaginatedActivitiesResponse(IEnumerable<StravaActivityDto> Activities,
    int Total, int Page, int PerPage, int TotalPages);

// Google Calendar
public record GoogleCalendarStatus(bool Connected, string? CalendarName, string? CalendarId, DateTime? LastSyncedAt);

// Training Plans
public record CreatePlanRequest(
    [Required][MinLength(3)] string Name,
    [Required][MinLength(2)] string GoalEvent,
    [Required] string GoalDate,          // ISO date string
    [Range(0, 300)] double CurrentWeeklyVolumeKm,
    [Range(1, 7)] int RunsPerWeek = 3,
    [Range(0, 6)] int? EasyRunDay = null,
    [Range(0, 6)] int? LongRunDay = null,
    [Range(0, 6)] int? IntervalRunDay = null);

public record UpdateSessionRequest(
    string? Date,
    string? SessionType,
    string? Description,
    [Range(0, 300)] double? PlannedDistanceKm,
    [Range(0, 480)] int? PlannedDurationMin,
    bool? Completed,
    bool? Skipped,
    string? StravaActivityId);

public record TrainingPlanDto(Guid Id, Guid UserId, string Name, string GoalEvent,
    DateOnly GoalDate, bool IsActive, double CurrentWeeklyVolumeKm, int RunsPerWeek,
    int? EasyRunDay, int? LongRunDay, int? IntervalRunDay, DateTime CreatedAt, DateTime UpdatedAt);

public record TrainingWeekDto(Guid Id, Guid PlanId, int WeekNumber, DateOnly StartDate,
    string? Focus, double WeeklyVolumeKm, bool IsTaperWeek, bool IsCutbackWeek, DateTime CreatedAt);

public record TrainingSessionDto(Guid Id, Guid WeekId, DateOnly Date, string SessionType,
    string? Description, double? PlannedDistanceKm, int? PlannedDurationMin,
    bool Completed, bool Skipped, string? StravaActivityId,
    StravaActivityDto? StravaActivity, DateTime CreatedAt, DateTime UpdatedAt);

public record RaceDto(Guid Id, Guid PlanId, string Name, DateOnly Date, double DistanceKm,
    string Type, string? Location, string? Approach, DateTime CreatedAt);

public record CreateRaceRequest(
    [Required][MinLength(2)] string Name,
    [Required] string Date,
    [Range(0.1, 500)] double DistanceKm,
    string? Location = null,
    string? Approach = null);

public record UpdateRaceRequest(
    string? Name = null,
    string? Date = null,
    double? DistanceKm = null,
    string? Location = null,
    string? Approach = null);

public record PlanDetailDto(Guid Id, Guid UserId, string Name, string GoalEvent,
    DateOnly GoalDate, bool IsActive, double CurrentWeeklyVolumeKm, int RunsPerWeek,
    int? EasyRunDay, int? LongRunDay, int? IntervalRunDay, DateTime CreatedAt, DateTime UpdatedAt,
    IEnumerable<TrainingWeekDto> Weeks,
    IEnumerable<TrainingSessionDto> Sessions,
    IEnumerable<RaceDto> Races);
