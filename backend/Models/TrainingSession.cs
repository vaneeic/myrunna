using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

public enum SessionType
{
    easy_run,
    long_run,
    tempo,
    intervals,
    recovery,
    race,
    rest
}

[Table("training_sessions")]
public class TrainingSession
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("week_id")] public Guid WeekId { get; set; }
    [Column("date")] public DateOnly Date { get; set; }
    [Column("session_type")] public SessionType SessionType { get; set; }
    [Column("description")] public string? Description { get; set; }
    [Column("planned_distance_km")] public double? PlannedDistanceKm { get; set; }
    [Column("planned_duration_min")] public int? PlannedDurationMin { get; set; }
    [Column("completed")] public bool Completed { get; set; }
    [Column("skipped")] public bool Skipped { get; set; }
    [Column("strava_activity_id")] public string? StravaActivityId { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public TrainingWeek Week { get; set; } = null!;
}
