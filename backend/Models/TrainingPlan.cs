using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("training_plans")]
public class TrainingPlan
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("user_id")] public Guid UserId { get; set; }
    [Column("name")] public string Name { get; set; } = string.Empty;
    [Column("goal_event")] public string GoalEvent { get; set; } = string.Empty;
    [Column("goal_date")] public DateOnly GoalDate { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("current_weekly_volume_km")] public double CurrentWeeklyVolumeKm { get; set; }
    [Column("runs_per_week")] public int RunsPerWeek { get; set; } = 3;
    [Column("easy_run_day")] public int? EasyRunDay { get; set; }
    [Column("long_run_day")] public int? LongRunDay { get; set; }
    [Column("interval_run_day")] public int? IntervalRunDay { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<TrainingWeek> Weeks { get; set; } = [];
    public ICollection<Race> Races { get; set; } = [];
}
