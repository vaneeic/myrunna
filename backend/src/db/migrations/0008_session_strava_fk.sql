-- Drop the temporary strava_activity_url column added in 0007.
-- The strava_activity_id column (varchar, stores Strava numeric ID) is used
-- to reference strava_activities.strava_id for proper activity linking.
ALTER TABLE training_sessions
  DROP COLUMN IF EXISTS strava_activity_url;
