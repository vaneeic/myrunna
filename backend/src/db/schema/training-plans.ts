import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  text,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const raceTypeEnum = pgEnum('race_type', ['A', 'B', 'C']);

export const sessionTypeEnum = pgEnum('session_type', [
  'easy_run',
  'long_run',
  'tempo',
  'intervals',
  'recovery',
  'race',
  'rest',
]);

export const trainingPlans = pgTable('training_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  goalEvent: varchar('goal_event', { length: 255 }).notNull(),
  goalDate: date('goal_date').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  currentWeeklyVolumeKm: doublePrecision('current_weekly_volume_km')
    .notNull()
    .default(0),
  // Training preferences (0=Sunday, 1=Monday, ..., 6=Saturday)
  runsPerWeek: integer('runs_per_week').notNull().default(3),
  easyRunDay: integer('easy_run_day'), // e.g., 2 for Tuesday
  longRunDay: integer('long_run_day'), // e.g., 0 for Sunday
  intervalRunDay: integer('interval_run_day'), // e.g., 4 for Thursday
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const races = pgTable('races', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => trainingPlans.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  date: date('date').notNull(),
  distanceKm: doublePrecision('distance_km').notNull(),
  type: raceTypeEnum('type').notNull().default('B'),
  location: varchar('location', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const trainingWeeks = pgTable('training_weeks', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => trainingPlans.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  startDate: date('start_date').notNull(),
  focus: varchar('focus', { length: 255 }),
  weeklyVolumeKm: doublePrecision('weekly_volume_km').notNull().default(0),
  isTaperWeek: boolean('is_taper_week').notNull().default(false),
  isCutbackWeek: boolean('is_cutback_week').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const trainingSessions = pgTable('training_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekId: uuid('week_id')
    .notNull()
    .references(() => trainingWeeks.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sessionType: sessionTypeEnum('session_type').notNull(),
  description: text('description'),
  plannedDistanceKm: doublePrecision('planned_distance_km'),
  plannedDurationMin: integer('planned_duration_min'),
  completed: boolean('completed').notNull().default(false),
  skipped: boolean('skipped').notNull().default(false),
  stravaActivityId: varchar('strava_activity_id', { length: 50 }),
  stravaActivityUrl: varchar('strava_activity_url', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type NewTrainingPlan = typeof trainingPlans.$inferInsert;
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type TrainingWeek = typeof trainingWeeks.$inferSelect;
export type NewTrainingWeek = typeof trainingWeeks.$inferInsert;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type NewTrainingSession = typeof trainingSessions.$inferInsert;
