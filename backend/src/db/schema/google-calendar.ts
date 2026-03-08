import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const googleCredentials = pgTable('google_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Tokens stored AES-256-GCM encrypted (same pattern as Strava)
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  // The Google Calendar ID for the user's "MyRunna" calendar
  calendarId: text('calendar_id').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type GoogleCredential = typeof googleCredentials.$inferSelect;
export type NewGoogleCredential = typeof googleCredentials.$inferInsert;
