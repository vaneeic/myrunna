using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MyRunna.Api.Data;
using MyRunna.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Load .env file in development ───────────────────────────────────────────
if (builder.Environment.IsDevelopment())
{
    var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
    if (File.Exists(envFile))
    {
        foreach (var line in File.ReadAllLines(envFile))
        {
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#')) continue;
            var parts = line.Split('=', 2);
            if (parts.Length == 2)
                Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
        }
    }
}

// Convert postgres:// URI to Npgsql connection string if needed
static string? ResolveConnectionString(string? raw)
{
    if (raw == null) return null;
    if (!raw.StartsWith("postgres://") && !raw.StartsWith("postgresql://")) return raw;
    var uri = new Uri(raw);
    var userInfo = uri.UserInfo.Split(':');
    var user = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var host = uri.Host;
    var port = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');
    return $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
}

// Map env vars into configuration sections
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["ConnectionStrings:DefaultConnection"] = ResolveConnectionString(Environment.GetEnvironmentVariable("DATABASE_URL")),
    ["Jwt:Secret"] = Environment.GetEnvironmentVariable("JWT_SECRET"),
    ["Jwt:ExpiresInDays"] = "7",
    ["Strava:ClientId"] = Environment.GetEnvironmentVariable("STRAVA_CLIENT_ID"),
    ["Strava:ClientSecret"] = Environment.GetEnvironmentVariable("STRAVA_CLIENT_SECRET"),
    ["Strava:RedirectUri"] = Environment.GetEnvironmentVariable("STRAVA_REDIRECT_URI"),
    ["Strava:TokenEncryptionKey"] = Environment.GetEnvironmentVariable("STRAVA_TOKEN_ENCRYPTION_KEY"),
    ["Strava:WebhookVerifyToken"] = Environment.GetEnvironmentVariable("STRAVA_WEBHOOK_VERIFY_TOKEN"),
    ["Google:ClientId"] = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID"),
    ["Google:ClientSecret"] = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET"),
    ["Google:RedirectUri"] = Environment.GetEnvironmentVariable("GOOGLE_REDIRECT_URI"),
    ["Google:TokenEncryptionKey"] = Environment.GetEnvironmentVariable("GOOGLE_TOKEN_ENCRYPTION_KEY"),
    ["App:FrontendUrl"] = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:4200",
    ["Anthropic:ApiKey"] = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"),
});

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("JWT_SECRET not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────
var frontendUrl = builder.Configuration["App:FrontendUrl"] ?? "http://localhost:4200";
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(frontendUrl)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

// ── App services ──────────────────────────────────────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UsersService>();
builder.Services.AddScoped<StravaTokenService>();
builder.Services.AddScoped<StravaService>();
builder.Services.AddScoped<GoogleCalendarService>();
builder.Services.AddScoped<TrainingPlansService>();
builder.Services.AddScoped<AiReschedulingService>();
builder.Services.AddHttpClient();
builder.Services.AddHostedService<StravaSyncScheduler>();

// ── Controllers + OpenAPI ─────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddOpenApi();

// ── Health checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!);

var app = builder.Build();

// ── Middleware pipeline ────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
