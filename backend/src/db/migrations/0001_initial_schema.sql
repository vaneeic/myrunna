-- Migration: 0001_initial_schema
-- Created: 2026-03-08
-- Description: Initial database schema for MyRunna

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE race_type AS ENUM ('A', 'B', 'C');

CREATE TYPE session_type AS ENUM (
  'easy_run',
  'long_run',
  'tempo',
  'intervals',
  'recovery',
  'race',
  'rest'
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Strava credentials (tokens stored AES-256 encrypted at application layer)
CREATE TABLE IF NOT EXISTS strava_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at BIGINT NOT NULL,  -- Unix timestamp (seconds)
  athlete_id BIGINT NOT NULL,
  scope VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strava_credentials_user_id ON strava_credentials(user_id);
CREATE INDEX idx_strava_credentials_athlete_id ON strava_credentials(athlete_id);

-- Strava activities cache
CREATE TABLE IF NOT EXISTS strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strava_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  distance DOUBLE PRECISION NOT NULL,  -- metres
  moving_time INTEGER NOT NULL,        -- seconds
  elapsed_time INTEGER NOT NULL,       -- seconds
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  average_heartrate DOUBLE PRECISION,
  max_heartrate DOUBLE PRECISION,
  average_cadence DOUBLE PRECISION,
  suffer_score INTEGER,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strava_activities_user_id ON strava_activities(user_id);
CREATE INDEX idx_strava_activities_strava_id ON strava_activities(strava_id);
CREATE INDEX idx_strava_activities_start_date ON strava_activities(start_date DESC);
CREATE INDEX idx_strava_activities_type ON strava_activities(type);

-- Training plans
CREATE TABLE IF NOT EXISTS training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal_event VARCHAR(255) NOT NULL,
  goal_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_weekly_volume_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_plans_user_id ON training_plans(user_id);
CREATE INDEX idx_training_plans_is_active ON training_plans(is_active);

-- Races (A/B/C priority races within a plan)
CREATE TABLE IF NOT EXISTS races (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  type race_type NOT NULL DEFAULT 'B',
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_races_plan_id ON races(plan_id);
CREATE INDEX idx_races_date ON races(date);

-- Training weeks
CREATE TABLE IF NOT EXISTS training_weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  focus VARCHAR(255),
  weekly_volume_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_taper_week BOOLEAN NOT NULL DEFAULT false,
  is_cutback_week BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, week_number)
);

CREATE INDEX idx_training_weeks_plan_id ON training_weeks(plan_id);
CREATE INDEX idx_training_weeks_start_date ON training_weeks(start_date);

-- Training sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id UUID NOT NULL REFERENCES training_weeks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_type session_type NOT NULL,
  description TEXT,
  planned_distance_km DOUBLE PRECISION,
  planned_duration_min INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  strava_activity_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_sessions_week_id ON training_sessions(week_id);
CREATE INDEX idx_training_sessions_date ON training_sessions(date);
CREATE INDEX idx_training_sessions_completed ON training_sessions(completed);
CREATE INDEX idx_training_sessions_strava_id ON training_sessions(strava_activity_id);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strava_credentials_updated_at
  BEFORE UPDATE ON strava_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strava_activities_updated_at
  BEFORE UPDATE ON strava_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
