using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("users")]
public class User
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("email")] public string Email { get; set; } = string.Empty;
    [Column("password_hash")] public string PasswordHash { get; set; } = string.Empty;
    [Column("display_name")] public string DisplayName { get; set; } = string.Empty;
    [Column("pace_5k_min_per_km")] public double? Pace5kMinPerKm { get; set; }
    [Column("pace_10k_min_per_km")] public double? Pace10kMinPerKm { get; set; }
    [Column("pace_15k_min_per_km")] public double? Pace15kMinPerKm { get; set; }
    [Column("pace_half_marathon_min_per_km")] public double? PaceHalfMarathonMinPerKm { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    [Column("is_active")] public bool IsActive { get; set; } = true;

    public StravaCredential? StravaCredential { get; set; }
    public GoogleCredential? GoogleCredential { get; set; }
    public ICollection<StravaActivity> StravaActivities { get; set; } = [];
    public ICollection<TrainingPlan> TrainingPlans { get; set; } = [];
}
