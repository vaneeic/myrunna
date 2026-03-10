using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Data;
using MyRunna.Api.DTOs;
using MyRunna.Api.Models;

namespace MyRunna.Api.Services;

public class UsersService(AppDbContext db)
{
    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        return user is null ? null : AuthService.MapUser(user);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest req)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        if (req.DisplayName is not null)
            user.DisplayName = req.DisplayName;

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return AuthService.MapUser(user);
    }

    public async Task<UserDto> UpdatePacesAsync(Guid userId, UpdatePacesRequest req)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        if (req.Pace5kMinPerKm.HasValue) user.Pace5kMinPerKm = req.Pace5kMinPerKm;
        if (req.Pace10kMinPerKm.HasValue) user.Pace10kMinPerKm = req.Pace10kMinPerKm;
        if (req.Pace15kMinPerKm.HasValue) user.Pace15kMinPerKm = req.Pace15kMinPerKm;
        if (req.PaceHalfMarathonMinPerKm.HasValue) user.PaceHalfMarathonMinPerKm = req.PaceHalfMarathonMinPerKm;

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return AuthService.MapUser(user);
    }
}
