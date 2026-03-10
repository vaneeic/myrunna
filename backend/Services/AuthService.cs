using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MyRunna.Api.Data;
using MyRunna.Api.DTOs;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest req)
    {
        var existing = await db.Users.AnyAsync(u => u.Email == req.Email.ToLower());
        if (existing)
            throw new InvalidOperationException("Email already in use.");

        var user = new User
        {
            Email = req.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, 12),
            DisplayName = req.DisplayName
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return new AuthResponse(CreateToken(user), MapUser(user));
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLower())
            ?? throw new UnauthorizedAccessException("Invalid email or password.");

        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is inactive.");

        return new AuthResponse(CreateToken(user), MapUser(user));
    }

    private string CreateToken(User user)
    {
        var secret = config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var expiresDays = int.TryParse(config["Jwt:ExpiresInDays"], out var d) ? d : 7;
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expiresDays),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static UserDto MapUser(User user) => new(
        user.Id, user.Email, user.DisplayName, user.CreatedAt,
        user.Pace5kMinPerKm, user.Pace10kMinPerKm, user.Pace15kMinPerKm, user.PaceHalfMarathonMinPerKm);
}
