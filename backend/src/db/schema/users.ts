import { pgTable, uuid, varchar, timestamp, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  // Distance-specific pace targets (min/km) - calculated from Strava or manually set
  pace5kMinPerKm: doublePrecision('pace_5k_min_per_km'),
  pace10kMinPerKm: doublePrecision('pace_10k_min_per_km'),
  pace15kMinPerKm: doublePrecision('pace_15k_min_per_km'),
  paceHalfMarathonMinPerKm: doublePrecision('pace_half_marathon_min_per_km'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
