using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("strava_activities")]
public class StravaActivity
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("user_id")] public Guid UserId { get; set; }
    [Column("strava_id")] public string StravaId { get; set; } = string.Empty;
    [Column("name")] public string Name { get; set; } = string.Empty;
    [Column("type")] public string Type { get; set; } = string.Empty;
    [Column("distance")] public double Distance { get; set; }
    [Column("moving_time")] public int MovingTime { get; set; }
    [Column("elapsed_time")] public int ElapsedTime { get; set; }
    [Column("start_date")] public DateTime StartDate { get; set; }
    [Column("average_heartrate")] public double? AverageHeartrate { get; set; }
    [Column("max_heartrate")] public double? MaxHeartrate { get; set; }
    [Column("average_cadence")] public double? AverageCadence { get; set; }
    [Column("suffer_score")] public int? SufferScore { get; set; }
    [Column("raw_json", TypeName = "jsonb")] public string? RawJson { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
