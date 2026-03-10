using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("training_weeks")]
public class TrainingWeek
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("plan_id")] public Guid PlanId { get; set; }
    [Column("week_number")] public int WeekNumber { get; set; }
    [Column("start_date")] public DateOnly StartDate { get; set; }
    [Column("focus")] public string? Focus { get; set; }
    [Column("weekly_volume_km")] public double WeeklyVolumeKm { get; set; }
    [Column("is_taper_week")] public bool IsTaperWeek { get; set; }
    [Column("is_cutback_week")] public bool IsCutbackWeek { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TrainingPlan Plan { get; set; } = null!;
    public ICollection<TrainingSession> Sessions { get; set; } = [];
}
