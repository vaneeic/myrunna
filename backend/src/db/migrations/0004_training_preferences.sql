-- Migration: Add training preferences to training_plans table
-- Created: 2026-03-08

-- Add columns for weekly training schedule preferences
ALTER TABLE training_plans
ADD COLUMN runs_per_week INTEGER NOT NULL DEFAULT 3,
ADD COLUMN easy_run_day INTEGER,
ADD COLUMN long_run_day INTEGER,
ADD COLUMN interval_run_day INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN training_plans.runs_per_week IS 'Number of runs per week (e.g., 3)';
COMMENT ON COLUMN training_plans.easy_run_day IS 'Day of week for easy runs (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN training_plans.long_run_day IS 'Day of week for long runs (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN training_plans.interval_run_day IS 'Day of week for interval/mixed runs (0=Sunday, 1=Monday, ..., 6=Saturday)';
