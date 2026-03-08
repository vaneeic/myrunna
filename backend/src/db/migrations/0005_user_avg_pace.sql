-- Migration: Add average pace tracking to users
-- Created: 2026-03-08

-- Add avg_pace_min_per_km column to users table
ALTER TABLE users
ADD COLUMN avg_pace_min_per_km DOUBLE PRECISION;

-- Add comment
COMMENT ON COLUMN users.avg_pace_min_per_km IS 'User average running pace in minutes per kilometer (calculated from Strava activities)';
