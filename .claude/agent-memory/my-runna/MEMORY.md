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

## Phase Status (as of Phase 3 commit)
- Phase 1: Complete (scaffold, schema, auth, strava base, frontend base)
- Phase 2: Strava OAuth + sync scaffolded; nightly cron + webhooks TODO
- Phase 3: Complete — full CRUD, session update endpoint, CDK drag-and-drop, signal state
- Phase 4: Calendar .ics export — NOT started
- Phase 5: Drag-and-drop done in Phase 3; Gantt/calendar view TODO

## Plans Feature (Phase 3)
- `PlansService` — signal-based; `plans`, `loading`, `activePlan` signals exposed
- `SESSION_TYPE_CONFIG` map exported from plans.service for colour-coded session badges
- `updateSession` endpoint: `PATCH /api/training-plans/:id/sessions/:sessionId`
- `UpdateSessionDto` at `backend/src/training-plans/dto/update-session.dto.ts`
- CDK DragDropModule used for session reordering — import from `@angular/cdk/drag-drop`
- Plan detail: optimistic UI updates with rollback on API error
- `groupSessionsByWeek()` returns `Map<string, TrainingSession[]>` sorted by date

## Common Pitfalls
- `tsconfig.json` uses `module: nodenext` — imports may need file extensions
- Angular Material + Tailwind: `preflight: false` in tailwind.config.js to avoid style conflicts
- Strava token refresh: always check `isTokenExpired()` with 5min buffer before API calls
- CDK drag-and-drop: import `DragDropModule` (not from @angular/material)
- `window.confirm()` is fine for simple delete confirmations — no MatDialog needed
