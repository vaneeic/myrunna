-- Replace single avg pace with distance-specific pace targets
ALTER TABLE users DROP COLUMN IF EXISTS avg_pace_min_per_km;

ALTER TABLE users ADD COLUMN pace_5k_min_per_km DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN pace_10k_min_per_km DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN pace_15k_min_per_km DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN pace_half_marathon_min_per_km DOUBLE PRECISION;

COMMENT ON COLUMN users.pace_5k_min_per_km IS 'Average pace for 5K runs (min/km)';
COMMENT ON COLUMN users.pace_10k_min_per_km IS 'Average pace for 10K runs (min/km)';
COMMENT ON COLUMN users.pace_15k_min_per_km IS 'Average pace for 15K runs (min/km)';
COMMENT ON COLUMN users.pace_half_marathon_min_per_km IS 'Average pace for half marathon runs (min/km)';
