# MyRunna — Agent Memory

## Project Overview
Personal running plan management app. Monorepo at `/Users/vaneeic/myrunna/`.
GitHub repo: https://github.com/vaneeic/myrunna (SSH: git@github.com:vaneeic/myrunna.git)

## Tech Stack
- Frontend: Angular 19 (standalone, signals) + Angular Material + TailwindCSS
- Backend: NestJS + Drizzle ORM + PostgreSQL
- Auth: JWT (7d) + bcrypt (12 rounds)
- Strava: AES-256-GCM token encryption at rest
- Deployment: Railway
- Package manager: npm (NOT bun — workspace uses npm workspaces)

## Key Paths
- Backend entry: `backend/src/main.ts`
- DB schema: `backend/src/db/schema/` (users.ts, strava.ts, training-plans.ts)
- Migration SQL: `backend/src/db/migrations/0001_initial_schema.sql`
- Frontend routes: `frontend/src/app/app.routes.ts`
- Plans service: `frontend/src/app/shared/services/plans.service.ts`
- Env template: `.env.example` (copy to `backend/.env` for local dev)

## Architecture Decisions
- DatabaseModule is `@Global()` — no need to import in feature modules
- Strava tokens: AES-256-GCM, key in `STRAVA_TOKEN_ENCRYPTION_KEY` (64 hex chars)
- AllExceptionsFilter registered globally in main.ts
- Angular uses functional guards (authGuard) and functional interceptors (authInterceptor)
- Drizzle `inArray` used for batch session fetches (not subqueries)
- Drizzle `innerJoin` is a query-builder method — NOT a named import from drizzle-orm

## Phase Status (as of March 8, 2026)
- Phase 1: Complete (scaffold, schema, auth, strava base, frontend base)
- Phase 2: Complete (Strava OAuth, sync, nightly cron, distance-specific pace calculation)
- Phase 3: Complete (CRUD, session update, CDK drag-and-drop, signal state)
- Phase 3.5: Complete (Training preferences: runs per week, preferred days for sessions)
- Phase 3.6: Complete (Distance-specific pace tracking, manual pace editing, realistic durations)
- Phase 4: Partial (Google Calendar integration done, .ics export available, webcal:// subscribable)
- Phase 5: Partial (Auth, dashboard, plans, settings with pace management, Strava view — drag-and-drop done in Phase 3; Gantt/timeline view TODO)

## Plans Feature (Phase 3 + 3.5)
- `PlansService` — signal-based; `plans`, `loading`, `activePlan` signals exposed
- `SESSION_TYPE_CONFIG` map exported from plans.service for colour-coded session badges
- `updateSession` endpoint: `PATCH /api/training-plans/:id/sessions/:sessionId`
- `UpdateSessionDto` at `backend/src/training-plans/dto/update-session.dto.ts`
- CDK DragDropModule used for session reordering — import from `@angular/cdk/drag-drop`
- Plan detail: optimistic UI updates with rollback on API error
- `groupSessionsByWeek()` returns `Map<string, TrainingSession[]>` sorted by date

### Training Preferences (Phase 3.5)
- `runsPerWeek`: 3, 4, or 5 runs per week (default: 3)
- `easyRunDay`, `longRunDay`, `intervalRunDay`: integers 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
- Defaults: Tuesday=easy, Sunday=long, Thursday=interval/tempo
- Session generation now respects user preferences for scheduling
- Migration 0004_training_preferences.sql adds columns to training_plans table
- Frontend create-plan form has dropdowns for schedule preferences

### Distance-Specific Pace Tracking (Phase 3.6)
**CRITICAL**: Always create migration BEFORE modifying schema files!

**Users table now has 4 distance-specific pace fields** (replaced `avgPaceMinPerKm`):
- `pace_5k_min_per_km` - for 3-7km runs
- `pace_10k_min_per_km` - for 8-12km runs
- `pace_15k_min_per_km` - for 13-18km runs
- `pace_half_marathon_min_per_km` - for 19-25km runs

**Strava sync calculates paces** (`backend/src/strava/strava.service.ts:updateUserPacesByDistance()`):
- Fetches last 50 run activities (3-30km range)
- Filters by distance range, takes max 10 most recent per range
- Weighted average: recent activity weight = 1.0, oldest = 0.5
- Auto-runs after each Strava sync

**Session duration formula** (`backend/src/training-plans/training-plans.service.ts`):
```
duration_min = distance_km × pace_for_distance × type_multiplier
```
Type multipliers:
- Easy: 1.1 (10% slower), Long: 1.0, Tempo: 0.9 (10% faster)
- Intervals: 0.8 (20% faster), Recovery: 1.15 (15% slower)

**Manual pace editing**:
- Endpoint: `PATCH /api/users/me/paces` (UpdatePacesDto)
- Frontend: Settings page "Training Paces" section (decimal format: 5:30/km = 5.5)
- UsersService: `frontend/src/app/shared/services/users.service.ts`

**Day-of-week calculation**: Sessions scheduled using `daysToAdd = dayOffset - weekStartDay` (add 7 if negative). DON'T use simple offset arithmetic.

## Common Pitfalls
- **Schema changes require migrations first** — modifying schema without migration causes "column does not exist" errors
- `tsconfig.json` uses `module: nodenext` — imports may need file extensions
- Angular Material + Tailwind: `preflight: false` in tailwind.config.js to avoid style conflicts
- Strava token refresh: always check `isTokenExpired()` with 5min buffer before API calls
- CDK drag-and-drop: import `DragDropModule` (not from @angular/material)
- `window.confirm()` is fine for simple delete confirmations — no MatDialog needed
