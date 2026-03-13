using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

public enum RaceType { A, B, C }

[Table("races")]
public class Race
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("plan_id")] public Guid PlanId { get; set; }
    [Column("name")] public string Name { get; set; } = string.Empty;
    [Column("date")] public DateOnly Date { get; set; }
    [Column("distance_km")] public double DistanceKm { get; set; }
    [Column("type")] public RaceType Type { get; set; } = RaceType.B;
    [Column("location")] public string? Location { get; set; }
    [Column("approach")] public string? Approach { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TrainingPlan Plan { get; set; } = null!;
}
