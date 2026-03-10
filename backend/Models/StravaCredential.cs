using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("strava_credentials")]
public class StravaCredential
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("user_id")] public Guid UserId { get; set; }
    [Column("access_token_encrypted")] public string AccessTokenEncrypted { get; set; } = string.Empty;
    [Column("refresh_token_encrypted")] public string RefreshTokenEncrypted { get; set; } = string.Empty;
    [Column("expires_at")] public long ExpiresAt { get; set; }
    [Column("athlete_id")] public long AthleteId { get; set; }
    [Column("athlete_name")] public string? AthleteName { get; set; }
    [Column("scope")] public string Scope { get; set; } = string.Empty;
    [Column("last_synced_at")] public DateTime? LastSyncedAt { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
