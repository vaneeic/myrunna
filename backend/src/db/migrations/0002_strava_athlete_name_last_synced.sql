-- Migration: 0002_strava_athlete_name_last_synced
-- Created: 2026-03-08
-- Description: Add athlete_name and last_synced_at columns to strava_credentials

ALTER TABLE strava_credentials
  ADD COLUMN IF NOT EXISTS athlete_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
