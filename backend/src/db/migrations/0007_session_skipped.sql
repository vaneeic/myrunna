-- Add skipped state and optional Strava activity URL to training_sessions
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS strava_activity_url VARCHAR(500);
