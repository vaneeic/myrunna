---
name: my-runna
description: "When working on  my MyRunna app"
model: sonnet
memory: project
---

# MyRunna — Claude Code Prompt

> Paste this prompt directly into Claude Code to scaffold and build your personal running plan management app.

---

```
You are helping me build "MyRunna" — a personal running plan management app inspired by Runna. 
This is a greenfield project. Start by scaffolding the full stack, then we'll build feature by feature.

## Tech Stack
- **Frontend**: Angular 19+ (standalone components, signals, Angular Material or TailwindCSS)
- **Backend**: Node.js + Express (or NestJS if you think it fits better — explain your choice)
- **Database**: PostgreSQL (hosted on Railway)
- **Deployment**: Railway (both frontend static hosting and backend service)
- **Auth**: JWT-based auth with bcrypt password hashing
- **External API**: Strava API v3

---

## Phase 1 — Project Scaffolding

1. Create a monorepo structure:
   ```
   myrunna/
   ├── frontend/   (Angular app)
   ├── backend/    (Node/NestJS API)
   └── shared/     (shared TypeScript types/interfaces)
   ```

2. Set up the PostgreSQL schema with these core tables:
   - `users` (id, email, password_hash, display_name, pace_5k_min_per_km, pace_10k_min_per_km, pace_15k_min_per_km, pace_half_marathon_min_per_km, created_at)
   - `strava_credentials` (user_id, access_token, refresh_token, expires_at, athlete_id, scope)
   - `training_plans` (id, user_id, name, goal_event, goal_date, created_at, is_active, runs_per_week, easy_run_day, long_run_day, interval_run_day)
   - `races` (id, plan_id, name, date, distance_km, type ENUM('A','B','C'), location)
   - `training_weeks` (id, plan_id, week_number, start_date, focus, weekly_volume_km, is_taper_week, is_cutback_week)
   - `training_sessions` (id, week_id, date, session_type, description, planned_distance_km, planned_duration_min, completed, strava_activity_id)
   - `strava_activities` (id, user_id, strava_id, name, type, distance, moving_time, elapsed_time, start_date, average_heartrate, max_heartrate, average_cadence, suffer_score, raw_json)

3. Generate Railway `railway.toml` and `.env.example` files with all required variables.

---

## Phase 2 — Strava Integration

Before coding, explain:
- What OAuth 2.0 scopes we need (activity:read_all, profile:read_all, etc.)
- How Strava's token refresh flow works (short-lived access tokens)
- What data is available from GET /athlete/activities (fields, pagination limits)
- Whether webhook subscriptions are available for real-time activity sync (Strava Push Subscriptions)
- Rate limits we need to respect (100 req/15min, 1000/day)

Then implement:
- OAuth2 callback endpoint: `GET /api/strava/connect` → redirect to Strava
- Callback handler: `GET /api/strava/callback` → exchange code, store tokens
- Token refresh middleware (check expiry before every Strava API call)
- `GET /api/strava/sync` — manually trigger activity import for last 30 days
- Background job (node-cron or BullMQ) that syncs activities every night at 02:00
- **Distance-specific pace calculation**: After each sync, analyze recent activities to calculate separate paces for 5K (3-7km), 10K (8-12km), 15K (13-18km), and half marathon (19-25km) distances using weighted averages (recent activities weighted higher)

---

## Phase 3 — Training Plan Builder

- CRUD for Training Plans with a target race (A-race) + optional B/C races
- When B/C races are added, automatically flag sessions in that week as a race-taper 
- **Training preferences**: User selects runs per week (3, 4, 5+) and preferred days for easy runs, long runs, and interval/tempo sessions (0=Sunday...6=Saturday)
- Week-by-week plan generation based on:
  - Target race date
  - Current weekly volume (pulled from Strava history or user input)
  - Progressive overload logic (10% rule, cutback weeks every 4th week)
- **Realistic duration estimates**: Session durations calculated from user's distance-specific paces with type-based multipliers (easy runs = pace × 1.1, long runs = pace × 1.0, tempo = pace × 0.9, intervals = pace × 0.8, recovery = pace × 1.15)
- Session types: Easy Run, Long Run, Tempo, Intervals, Recovery, Race
- **Manual pace override**: Users can manually adjust their target paces in settings if Strava data is unavailable or inaccurate

---

## Phase 4 — Calendar Export

- Generate an `.ics` file (iCalendar) for the full training plan
- Each session becomes a calendar event with: title, description (workout details), duration estimate
- Expose endpoint: `GET /api/plans/:id/calendar.ics` (with JWT auth token as query param for calendar app compatibility)
- Also expose a subscribable webcal:// link so the calendar auto-updates

---

## Phase 5 — Frontend (Angular)

Key pages/components:
- `/auth/login` and `/auth/register`
- `/dashboard` — upcoming sessions, recent Strava activities, weekly summary
- `/plans` — list of training plans
- `/plans/:id` — plan detail with a week-by-week timeline view (like a Gantt/calendar)
- `/plans/:id/builder` — drag-and-drop session scheduler
- `/settings` — Strava connect/disconnect, profile settings, **training pace management** (view auto-calculated paces from Strava or manually set target paces for 5K/10K/15K/HM distances)
- `/strava` — activity list with filtering

Use Angular signals for state management. No NgRx unless the complexity demands it.

---

## Constraints & Production Considerations

- All Strava tokens must be encrypted at rest in PostgreSQL (use pgcrypto or app-level AES-256)
- Never expose Strava tokens in API responses to the frontend
- Use database connection pooling (pg-pool)
- Add `helmet`, `cors`, and `express-rate-limit` to the backend
- Use Zod for request validation on all endpoints
- Write OpenAPI/Swagger docs for the backend API
- Add a `Dockerfile` for local dev with `docker-compose.yml` (PostgreSQL + backend + frontend)

---

## Start Here

Begin with Phase 1. Scaffold the monorepo, create the database migration files (use `node-postgres` with raw SQL migrations or Drizzle ORM — explain your choice), and set up the Railway config. 

Ask me before making any major architectural decisions not covered above.
```

---

## Notes

### Strava API gotchas
- Access tokens expire after **6 hours** — the refresh flow is non-negotiable from day one.
- Webhook/push subscriptions require a **publicly accessible endpoint** even during development. Use `railway up` or `ngrok` to test locally.
- Free Strava API access is generous but the **1000 req/day limit** matters once you have historical sync.
- `activity:read_all` gives private activities; `activity:read` does not — choose your scope carefully during OAuth setup.

### Railway specifics
- PostgreSQL is a native Railway plugin — you'll get a `DATABASE_URL` env var injected automatically into your service.
- The `railway.toml` in the prompt wires the deploy config correctly for both frontend and backend services.

---

## Implementation Status

### ✅ Completed Features

**Phase 1 - Project Scaffolding**
- Monorepo structure (frontend/backend/shared)
- Database schema with Drizzle ORM
- PostgreSQL migrations (0001-0006 applied)
- Railway deployment config

**Phase 2 - Strava Integration**
- OAuth2 flow (connect, callback, disconnect)
- Token refresh with AES-256-GCM encryption
- Activity sync (manual and nightly scheduler at 02:00)
- Distance-specific pace calculation (5K/10K/15K/HM) from recent run data

**Phase 3 - Training Plan Builder**
- CRUD operations for training plans
- Training preferences (runs per week, preferred session days)
- Progressive overload generation (+10% weekly, cutback every 4th week)
- Taper week logic (2 weeks before race)
- Pace-based duration calculations with session-type multipliers
- Manual pace override in user settings

**Phase 4 - Calendar Export** (Partial)
- Google Calendar integration (OAuth, sync events)
- `.ics` export endpoint implemented
- Subscribable webcal:// link available

**Phase 5 - Frontend**
- Auth pages (login/register)
- Dashboard with upcoming sessions
- Training plans list and creation flow
- Settings page with Strava integration, pace management
- Strava activities view

### 🚧 Pending Features
- Manual session date editing (drag-and-drop rescheduling)
- Session status tracking (completed, skipped)
- Plan detail with Gantt/timeline view
- B/C race management UI

---

# Persistent Agent Memory

You have a persistent Persistent Agent Memory directory at `/Users/vaneeic/myrunna/.claude/agent-memory/my-runna/`. Its contents persist across conversations.

As you work, consult your memory files to build on previous experience. When you encounter a mistake that seems like it could be common, check your Persistent Agent Memory for relevant notes — and if nothing is written yet, record what you learned.

Guidelines:
- `MEMORY.md` is always loaded into your system prompt — lines after 200 will be truncated, so keep it concise
- Create separate topic files (e.g., `debugging.md`, `patterns.md`) for detailed notes and link to them from MEMORY.md
- Update or remove memories that turn out to be wrong or outdated
- Organize memory semantically by topic, not chronologically
- Use the Write and Edit tools to update your memory files

What to save:
- Stable patterns and conventions confirmed across multiple interactions
- Key architectural decisions, important file paths, and project structure
- User preferences for workflow, tools, and communication style
- Solutions to recurring problems and debugging insights

What NOT to save:
- Session-specific context (current task details, in-progress work, temporary state)
- Information that might be incomplete — verify against project docs before writing
- Anything that duplicates or contradicts existing CLAUDE.md instructions
- Speculative or unverified conclusions from reading a single file

Explicit user requests:
- When the user asks you to remember something across sessions (e.g., "always use bun", "never auto-commit"), save it — no need to wait for multiple interactions
- When the user asks to forget or stop remembering something, find and remove the relevant entries from your memory files
- When the user corrects you on something you stated from memory, you MUST update or remove the incorrect entry. A correction means the stored memory is wrong — fix it at the source before continuing, so the same mistake does not repeat in future conversations.
- Since this memory is project-scope and shared with your team via version control, tailor your memories to this project

## MEMORY.md

Project memory is maintained in `/Users/vaneeic/myrunna/.claude/agent-memory/my-runna/MEMORY.md`.

**Key patterns documented**:
- Database schema migration workflow (create migration BEFORE modifying schema)
- Distance-specific pace calculation logic (4 distance ranges with weighted averages)
- Session duration formulas (distance × pace × type multiplier)
- Day-of-week calculation for session scheduling
- File paths for core modules (backend services, frontend components)

Consult MEMORY.md before making changes to ensure consistency with established patterns.
