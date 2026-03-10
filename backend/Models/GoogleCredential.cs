using System.ComponentModel.DataAnnotations.Schema;

namespace MyRunna.Api.Models;

[Table("google_credentials")]
public class GoogleCredential
{
    [Column("id")] public Guid Id { get; set; } = Guid.NewGuid();
    [Column("user_id")] public Guid UserId { get; set; }
    [Column("encrypted_access_token")] public string EncryptedAccessToken { get; set; } = string.Empty;
    [Column("encrypted_refresh_token")] public string EncryptedRefreshToken { get; set; } = string.Empty;
    [Column("token_expires_at")] public DateTime TokenExpiresAt { get; set; }
    [Column("calendar_id")] public string CalendarId { get; set; } = string.Empty;
    [Column("last_synced_at")] public DateTime? LastSyncedAt { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
