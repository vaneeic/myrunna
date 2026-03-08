# MyRunna

A personal running plan management app inspired by Runna. Build smarter training plans, connect Strava, and track your progress toward race day.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19 (standalone, signals) + Angular Material + TailwindCSS |
| Backend | NestJS + Drizzle ORM |
| Database | PostgreSQL (Railway) |
| Auth | JWT + bcrypt |
| External API | Strava API v3 |
| Deployment | Railway |

## Project Structure

```
myrunna/
├── frontend/          Angular 19 SPA
├── backend/           NestJS API
├── shared/            Shared TypeScript types
├── docker-compose.yml Local dev with PostgreSQL
├── .env.example       Environment variable template
└── railway.toml       Railway deployment config
```

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)

### 1. Clone and install

```bash
git clone https://github.com/icvanee/myrunna.git
cd myrunna
npm install --workspace=backend
npm install --workspace=frontend
```

### 2. Configure environment

```bash
cp .env.example backend/.env
# Edit backend/.env with your values
```

Generate the required secrets:
```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Strava token encryption key (must be 64 hex chars / 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start PostgreSQL

```bash
docker-compose up postgres -d
```

### 4. Run database migrations

```bash
npm run migrate
```

### 5. Start development servers

```bash
# Terminal 1 — backend (http://localhost:3000)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:4200)
npm run dev:frontend
```

API docs available at: http://localhost:3000/api/docs

## Strava Setup

1. Create a Strava API app at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `localhost` (dev) or your Railway domain (prod)
3. Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` to `backend/.env`
4. Set `STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback`

> **Note:** Strava access tokens expire every 6 hours. The backend handles refresh automatically on every API call.

## Deployment (Railway)

1. Push to GitHub
2. Create two Railway services: `backend` (root: `/backend`) and `frontend` (root: `/frontend`)
3. Add Railway PostgreSQL plugin — `DATABASE_URL` is injected automatically
4. Set all environment variables from `.env.example` in Railway dashboard
5. Deploy

## Build Status

### Phase 1 — Scaffold (complete)
- [x] Monorepo: `frontend/`, `backend/`, `shared/`
- [x] NestJS backend with modules: auth, users, strava, training-plans, health
- [x] Drizzle ORM schema: users, strava_credentials, strava_activities, training_plans, races, training_weeks, training_sessions
- [x] SQL migration: `backend/src/db/migrations/0001_initial_schema.sql`
- [x] JWT auth (bcrypt, 7d tokens), Passport JWT strategy
- [x] Helmet, CORS, express-rate-limit, global ValidationPipe, global AllExceptionsFilter
- [x] Swagger/OpenAPI at `/api/docs`
- [x] Docker Compose for local PostgreSQL dev
- [x] Railway deployment config (`railway.toml`)
- [x] `.env.example` with all required variables

### Phase 2 — Strava Integration (scaffolded)
- [x] OAuth2 connect + callback endpoints
- [x] AES-256-GCM token encryption at rest
- [x] Automatic token refresh (6h expiry + 5min buffer)
- [x] Manual activity sync (`POST /api/strava/sync`)
- [ ] Background nightly sync (node-cron job)
- [ ] Strava webhook subscription (push events)

### Phase 3 — Training Plan Builder (scaffolded)
- [x] CRUD endpoints for training plans
- [x] Progressive overload generation (10% rule)
- [x] Cutback weeks (every 4th week, 70% volume)
- [x] Taper weeks (last 15% of plan)
- [x] 5-session weekly schedule (easy, intervals, tempo, long run, recovery)
- [ ] B/C race taper flagging
- [ ] Session editing / drag-and-drop reorder

### Phase 4 — Calendar Export
- [ ] `.ics` file generation
- [ ] `GET /api/plans/:id/calendar.ics`
- [ ] webcal:// subscription link

### Phase 5 — Angular Frontend (scaffolded)
- [x] Login + Register pages (Angular signals, Angular Material)
- [x] JWT auth interceptor + auth guard
- [x] Dashboard, Plans list, Plan detail, Settings, Strava pages
- [x] Strava connect/disconnect from Settings
- [x] Create training plan form with datepicker
- [ ] Week-by-week Gantt/timeline view
- [ ] Drag-and-drop session builder
- [ ] Dashboard with live data (upcoming sessions, weekly stats)
