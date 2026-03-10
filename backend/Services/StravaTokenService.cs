using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

/// <summary>
/// Handles AES-256-GCM encryption/decryption of OAuth tokens, stored as "iv:tag:ciphertext" (hex).
/// </summary>
public class TokenEncryptionService(string hexKey)
{
    private readonly byte[] _key = Convert.FromHexString(hexKey);

    public string Encrypt(string plaintext)
    {
        var iv = RandomNumberGenerator.GetBytes(12);
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(iv, plaintextBytes, ciphertext, tag);

        return $"{Convert.ToHexString(iv)}:{Convert.ToHexString(tag)}:{Convert.ToHexString(ciphertext)}";
    }

    public string Decrypt(string encrypted)
    {
        var parts = encrypted.Split(':');
        if (parts.Length != 3) throw new FormatException("Invalid encrypted token format.");

        var iv = Convert.FromHexString(parts[0]);
        var tag = Convert.FromHexString(parts[1]);
        var ciphertext = Convert.FromHexString(parts[2]);
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(iv, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
    }
}

public class StravaTokenService(AppDbContext db, IConfiguration config)
{
    private TokenEncryptionService Encryption => new(
        config["Strava:TokenEncryptionKey"] ?? throw new InvalidOperationException("Strava:TokenEncryptionKey not configured."));

    public async Task SaveTokensAsync(Guid userId, string accessToken, string refreshToken,
        long expiresAt, long athleteId, string? athleteName, string scope)
    {
        var existing = await db.StravaCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (existing is not null)
        {
            existing.AccessTokenEncrypted = Encryption.Encrypt(accessToken);
            existing.RefreshTokenEncrypted = Encryption.Encrypt(refreshToken);
            existing.ExpiresAt = expiresAt;
            existing.AthleteId = athleteId;
            existing.AthleteName = athleteName;
            existing.Scope = scope;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.StravaCredentials.Add(new StravaCredential
            {
                UserId = userId,
                AccessTokenEncrypted = Encryption.Encrypt(accessToken),
                RefreshTokenEncrypted = Encryption.Encrypt(refreshToken),
                ExpiresAt = expiresAt,
                AthleteId = athleteId,
                AthleteName = athleteName,
                Scope = scope
            });
        }
        await db.SaveChangesAsync();
    }

    public async Task<(string AccessToken, string RefreshToken, long ExpiresAt)?> GetDecryptedTokensAsync(Guid userId)
    {
        var cred = await db.StravaCredentials.FirstOrDefaultAsync(c => c.UserId == userId);
        if (cred is null) return null;
        return (Encryption.Decrypt(cred.AccessTokenEncrypted),
                Encryption.Decrypt(cred.RefreshTokenEncrypted),
                cred.ExpiresAt);
    }

    public async Task UpdateLastSyncedAtAsync(Guid userId)
    {
        await db.StravaCredentials
            .Where(c => c.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.LastSyncedAt, DateTime.UtcNow));
    }

    public async Task DeleteAsync(Guid userId)
    {
        await db.StravaCredentials.Where(c => c.UserId == userId).ExecuteDeleteAsync();
    }

    public async Task<List<Guid>> GetAllConnectedUserIdsAsync()
    {
        return await db.StravaCredentials.Select(c => c.UserId).ToListAsync();
    }

    public bool IsTokenExpired(long expiresAt)
        => DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds() >= expiresAt;
}
