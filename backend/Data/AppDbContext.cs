using Microsoft.EntityFrameworkCore;
using MyRunna.Api.Models;

namespace MyRunna.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<StravaCredential> StravaCredentials => Set<StravaCredential>();
    public DbSet<StravaActivity> StravaActivities => Set<StravaActivity>();
    public DbSet<GoogleCredential> GoogleCredentials => Set<GoogleCredential>();
    public DbSet<TrainingPlan> TrainingPlans => Set<TrainingPlan>();
    public DbSet<TrainingWeek> TrainingWeeks => Set<TrainingWeek>();
    public DbSet<TrainingSession> TrainingSessions => Set<TrainingSession>();
    public DbSet<Race> Races => Set<Race>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Enums stored as text (matching PostgreSQL)
        modelBuilder.HasPostgresEnum<SessionType>();
        modelBuilder.HasPostgresEnum<RaceType>();

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique().HasDatabaseName("idx_users_email");
            e.Property(u => u.Email).HasColumnName("email");
        });

        modelBuilder.Entity<StravaCredential>(e =>
        {
            e.HasOne(s => s.User).WithOne(u => u.StravaCredential)
                .HasForeignKey<StravaCredential>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.UserId).IsUnique().HasDatabaseName("idx_strava_credentials_user_id");
            e.HasIndex(s => s.AthleteId).HasDatabaseName("idx_strava_credentials_athlete_id");
        });

        modelBuilder.Entity<StravaActivity>(e =>
        {
            e.HasOne(a => a.User).WithMany(u => u.StravaActivities)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(a => a.StravaId).IsUnique().HasDatabaseName("idx_strava_activities_strava_id");
            e.HasIndex(a => a.UserId).HasDatabaseName("idx_strava_activities_user_id");
            e.HasIndex(a => a.StartDate).HasDatabaseName("idx_strava_activities_start_date");
            e.HasIndex(a => a.Type).HasDatabaseName("idx_strava_activities_type");
        });

        modelBuilder.Entity<GoogleCredential>(e =>
        {
            e.HasOne(g => g.User).WithOne(u => u.GoogleCredential)
                .HasForeignKey<GoogleCredential>(g => g.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(g => g.UserId).IsUnique().HasDatabaseName("idx_google_credentials_user_id");
        });

        modelBuilder.Entity<TrainingPlan>(e =>
        {
            e.HasOne(p => p.User).WithMany(u => u.TrainingPlans)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => p.UserId).HasDatabaseName("idx_training_plans_user_id");
            e.HasIndex(p => p.IsActive).HasDatabaseName("idx_training_plans_is_active");
        });

        modelBuilder.Entity<TrainingWeek>(e =>
        {
            e.HasOne(w => w.Plan).WithMany(p => p.Weeks)
                .HasForeignKey(w => w.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TrainingSession>(e =>
        {
            e.HasOne(s => s.Week).WithMany(w => w.Sessions)
                .HasForeignKey(s => s.WeekId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(s => s.SessionType)
                .HasColumnType("session_type");
        });

        modelBuilder.Entity<Race>(e =>
        {
            e.HasOne(r => r.Plan).WithMany(p => p.Races)
                .HasForeignKey(r => r.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(r => r.Type)
                .HasColumnType("race_type");
        });
    }
}
