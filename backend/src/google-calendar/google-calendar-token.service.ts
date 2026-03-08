/**
 * GoogleCalendarTokenService
 *
 * Handles AES-256-GCM encryption/decryption for Google OAuth tokens
 * using the same algorithm and format as StravaTokenService.
 *
 * Encryption key: GOOGLE_TOKEN_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * Falls back to STRAVA_TOKEN_ENCRYPTION_KEY so operators can share one key.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as crypto from 'crypto';
import { DATABASE_CONNECTION } from '../db/database.module';
import { googleCredentials } from '../db/schema';
import * as schema from '../db/schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

@Injectable()
export class GoogleCalendarTokenService {
  private readonly logger = new Logger(GoogleCalendarTokenService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    // Prefer a dedicated key; fall back to the Strava key so single-key setups work
    const keyHex =
      this.configService.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ??
      this.configService.get<string>('STRAVA_TOKEN_ENCRYPTION_KEY');

    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'GOOGLE_TOKEN_ENCRYPTION_KEY (or STRAVA_TOKEN_ENCRYPTION_KEY) must be a 64-character hex string (32 bytes)',
      );
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  // ---------------------------------------------------------------------------
  // Encryption helpers — identical format to StravaTokenService: iv:tag:ciphertext
  // ---------------------------------------------------------------------------

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  // ---------------------------------------------------------------------------
  // DB helpers
  // ---------------------------------------------------------------------------

  async saveCredentials(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      calendarId: string;
    },
  ) {
    const values = {
      userId,
      encryptedAccessToken: this.encrypt(tokens.accessToken),
      encryptedRefreshToken: this.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      calendarId: tokens.calendarId,
      updatedAt: new Date(),
    };

    await this.db
      .insert(googleCredentials)
      .values(values)
      .onConflictDoUpdate({
        target: googleCredentials.userId,
        set: {
          encryptedAccessToken: values.encryptedAccessToken,
          encryptedRefreshToken: values.encryptedRefreshToken,
          tokenExpiresAt: values.tokenExpiresAt,
          calendarId: values.calendarId,
          updatedAt: values.updatedAt,
        },
      });
  }

  async updateTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: Date;
    },
  ) {
    const set: Partial<typeof googleCredentials.$inferInsert> = {
      encryptedAccessToken: this.encrypt(tokens.accessToken),
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    };
    if (tokens.refreshToken) {
      set.encryptedRefreshToken = this.encrypt(tokens.refreshToken);
    }
    await this.db
      .update(googleCredentials)
      .set(set)
      .where(eq(googleCredentials.userId, userId));
  }

  async updateLastSyncedAt(userId: string) {
    await this.db
      .update(googleCredentials)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(googleCredentials.userId, userId));
  }

  async getDecryptedCredentials(userId: string) {
    const result = await this.db
      .select()
      .from(googleCredentials)
      .where(eq(googleCredentials.userId, userId))
      .limit(1);

    const cred = result[0];
    if (!cred) return null;

    return {
      accessToken: this.decrypt(cred.encryptedAccessToken),
      refreshToken: this.decrypt(cred.encryptedRefreshToken),
      tokenExpiresAt: cred.tokenExpiresAt,
      calendarId: cred.calendarId,
      lastSyncedAt: cred.lastSyncedAt,
    };
  }

  async deleteCredentials(userId: string) {
    await this.db
      .delete(googleCredentials)
      .where(eq(googleCredentials.userId, userId));
    this.logger.log(`Google credentials removed for user ${userId}`);
  }

  isTokenExpired(expiresAt: Date): boolean {
    // 5-minute buffer before actual expiry
    return Date.now() > expiresAt.getTime() - 5 * 60 * 1000;
  }
}
