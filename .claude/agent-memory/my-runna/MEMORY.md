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
- Shared types: `shared/src/types/`
- Env template: `.env.example` (copy to `backend/.env` for local dev)

## Architecture Decisions
- DatabaseModule is `@Global()` — no need to import in feature modules
- Strava tokens: AES-256-GCM, key in `STRAVA_TOKEN_ENCRYPTION_KEY` (64 hex chars)
- AllExceptionsFilter registered globally in main.ts
- Angular uses functional guards (authGuard) and functional interceptors (authInterceptor)
- Drizzle `inArray` used for batch session fetches (not subqueries)

## Phase Status (as of Phase 1 commit)
- Phase 1: Complete (scaffold, schema, auth, strava base, frontend base)
- Phase 2: Strava OAuth + sync scaffolded; nightly cron + webhooks TODO
- Phase 3: Plan generation logic built; B/C race taper + session editing TODO
- Phase 4: Calendar .ics export — NOT started
- Phase 5: Frontend pages scaffolded; Gantt view + drag-and-drop TODO

## Common Pitfalls
- `tsconfig.json` uses `module: nodenext` — imports need file extensions in some cases
- Angular Material + Tailwind: `preflight: false` in tailwind.config.js to avoid style conflicts
- Strava token refresh: always check `isTokenExpired()` with 5min buffer before API calls
- `findOne` for training plans uses `inArray(trainingSessions.weekId, weekIds)` — not eq on first week only

## See Also
- `patterns.md` — (to be created as patterns emerge)
