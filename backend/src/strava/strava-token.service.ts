/**
 * StravaTokenService
 *
 * Handles encryption/decryption of Strava tokens at rest and the
 * 6-hour token refresh flow.
 *
 * Encryption: AES-256-GCM via Node's built-in crypto module.
 * Key: STRAVA_TOKEN_ENCRYPTION_KEY env var (32-byte hex string).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as crypto from 'crypto';
import { DATABASE_CONNECTION } from '../db/database.module';
import { stravaCredentials } from '../db/schema';
import * as schema from '../db/schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@Injectable()
export class StravaTokenService {
  private readonly logger = new Logger(StravaTokenService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    const keyHex = this.configService.get<string>('STRAVA_TOKEN_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'STRAVA_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
      );
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:ciphertext (all hex)
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

  async saveTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      athleteId: number;
      scope: string;
    },
  ) {
    const values = {
      userId,
      accessTokenEncrypted: this.encrypt(tokens.accessToken),
      refreshTokenEncrypted: this.encrypt(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      athleteId: tokens.athleteId,
      scope: tokens.scope,
    };

    await this.db
      .insert(stravaCredentials)
      .values(values)
      .onConflictDoUpdate({
        target: stravaCredentials.userId,
        set: {
          accessTokenEncrypted: values.accessTokenEncrypted,
          refreshTokenEncrypted: values.refreshTokenEncrypted,
          expiresAt: values.expiresAt,
          athleteId: values.athleteId,
          scope: values.scope,
        },
      });
  }

  async getDecryptedTokens(userId: string) {
    const result = await this.db
      .select()
      .from(stravaCredentials)
      .where(eq(stravaCredentials.userId, userId))
      .limit(1);

    const cred = result[0];
    if (!cred) return null;

    return {
      accessToken: this.decrypt(cred.accessTokenEncrypted),
      refreshToken: this.decrypt(cred.refreshTokenEncrypted),
      expiresAt: cred.expiresAt,
      athleteId: cred.athleteId,
      scope: cred.scope,
    };
  }

  isTokenExpired(expiresAt: number): boolean {
    // Add 5-minute buffer before actual expiry
    return Date.now() / 1000 > expiresAt - 300;
  }

  async deleteTokens(userId: string) {
    await this.db
      .delete(stravaCredentials)
      .where(eq(stravaCredentials.userId, userId));
    this.logger.log(`Strava credentials removed for user ${userId}`);
  }
}
