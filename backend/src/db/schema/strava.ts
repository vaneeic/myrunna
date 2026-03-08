import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  text,
  doublePrecision,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const stravaCredentials = pgTable('strava_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Tokens stored encrypted (AES-256 at app layer before insert)
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(), // Unix timestamp
  athleteId: bigint('athlete_id', { mode: 'number' }).notNull(),
  scope: varchar('scope', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const stravaActivities = pgTable('strava_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stravaId: varchar('strava_id', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // Run, Ride, etc.
  distance: doublePrecision('distance').notNull(), // metres
  movingTime: integer('moving_time').notNull(), // seconds
  elapsedTime: integer('elapsed_time').notNull(), // seconds
  startDate: timestamp('start_date').notNull(),
  averageHeartrate: doublePrecision('average_heartrate'),
  maxHeartrate: doublePrecision('max_heartrate'),
  averageCadence: doublePrecision('average_cadence'),
  sufferScore: integer('suffer_score'),
  rawJson: jsonb('raw_json'), // full Strava payload for future fields
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type StravaCredential = typeof stravaCredentials.$inferSelect;
export type NewStravaCredential = typeof stravaCredentials.$inferInsert;
export type StravaActivity = typeof stravaActivities.$inferSelect;
export type NewStravaActivity = typeof stravaActivities.$inferInsert;
