/**
 * StravaService
 *
 * Handles Strava OAuth flow, token refresh, and activity sync.
 *
 * Strava API notes:
 * - Access tokens expire after 6 hours — refresh is mandatory
 * - Rate limits: 100 req/15min, 1000 req/day
 * - activity:read_all scope required for private activities
 * - Pagination: max 200 activities per page
 */
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { firstValueFrom } from 'rxjs';
import { StravaTokenService } from './strava-token.service';
import { DATABASE_CONNECTION } from '../db/database.module';
import { stravaActivities } from '../db/schema';
import * as schema from '../db/schema';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly tokenService: StravaTokenService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const redirectUri = this.configService.get<string>('STRAVA_REDIRECT_URI');
    const scope = 'read,activity:read_all,profile:read_all';

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri!,
      response_type: 'code',
      approval_prompt: 'auto',
      scope,
      state: userId, // pass userId through OAuth state param
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, userId: string) {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('STRAVA_CLIENT_SECRET');

    try {
      const response = await firstValueFrom(
        this.httpService.post(STRAVA_TOKEN_URL, {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      );

      const { access_token, refresh_token, expires_at, athlete } =
        response.data;

      await this.tokenService.saveTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expires_at,
        athleteId: athlete.id,
        scope: 'read,activity:read_all,profile:read_all',
      });

      this.logger.log(`Strava connected for user ${userId}, athlete ${athlete.id}`);
      return athlete;
    } catch (err) {
      this.logger.error('Failed to exchange Strava code for tokens', err);
      throw new BadRequestException('Failed to connect Strava account');
    }
  }

  /**
   * Get a valid access token, refreshing if expired.
   * This is the entry point for all Strava API calls.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.tokenService.getDecryptedTokens(userId);
    if (!tokens) {
      throw new UnauthorizedException('Strava account not connected');
    }

    if (this.tokenService.isTokenExpired(tokens.expiresAt)) {
      return this.refreshAccessToken(userId, tokens.refreshToken);
    }

    return tokens.accessToken;
  }

  private async refreshAccessToken(
    userId: string,
    refreshToken: string,
  ): Promise<string> {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('STRAVA_CLIENT_SECRET');

    try {
      const response = await firstValueFrom(
        this.httpService.post(STRAVA_TOKEN_URL, {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      );

      const { access_token, refresh_token: new_refresh, expires_at, athlete } =
        response.data;

      const existing = await this.tokenService.getDecryptedTokens(userId);
      await this.tokenService.saveTokens(userId, {
        accessToken: access_token,
        refreshToken: new_refresh,
        expiresAt: expires_at,
        athleteId: athlete?.id ?? existing!.athleteId,
        scope: existing!.scope,
      });

      this.logger.log(`Refreshed Strava token for user ${userId}`);
      return access_token;
    } catch (err) {
      this.logger.error('Failed to refresh Strava token', err);
      throw new UnauthorizedException('Strava token refresh failed — please reconnect');
    }
  }

  async syncActivities(userId: string, daysBack = 30): Promise<{ imported: number; updated: number }> {
    const accessToken = await this.getValidAccessToken(userId);
    const after = Math.floor(Date.now() / 1000) - daysBack * 86400;

    let page = 1;
    let imported = 0;
    let updated = 0;

    // Strava max 200 per page; keep paginating until empty
    while (true) {
      const response = await firstValueFrom(
        this.httpService.get(`${STRAVA_API_BASE}/athlete/activities`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { after, per_page: 200, page },
        }),
      );

      const activities: any[] = response.data;
      if (!activities.length) break;

      for (const act of activities) {
        // Only sync Run activities
        if (!act.type.toLowerCase().includes('run')) continue;

        const values = {
          userId,
          stravaId: String(act.id),
          name: act.name,
          type: act.type,
          distance: act.distance,
          movingTime: act.moving_time,
          elapsedTime: act.elapsed_time,
          startDate: new Date(act.start_date),
          averageHeartrate: act.average_heartrate ?? null,
          maxHeartrate: act.max_heartrate ?? null,
          averageCadence: act.average_cadence ?? null,
          sufferScore: act.suffer_score ?? null,
          rawJson: act,
        };

        const existing = await this.db
          .select({ id: stravaActivities.id })
          .from(stravaActivities)
          .where(eq(stravaActivities.stravaId, values.stravaId))
          .limit(1);

        if (existing.length) {
          await this.db
            .update(stravaActivities)
            .set(values)
            .where(eq(stravaActivities.stravaId, values.stravaId));
          updated++;
        } else {
          await this.db.insert(stravaActivities).values(values);
          imported++;
        }
      }

      if (activities.length < 200) break;
      page++;
    }

    this.logger.log(
      `Strava sync for user ${userId}: +${imported} imported, ${updated} updated`,
    );
    return { imported, updated };
  }

  async getConnectionStatus(userId: string) {
    const tokens = await this.tokenService.getDecryptedTokens(userId);
    if (!tokens) {
      return { connected: false };
    }
    return {
      connected: true,
      athleteId: tokens.athleteId,
      scope: tokens.scope,
      expiresAt: tokens.expiresAt,
    };
  }

  async disconnect(userId: string) {
    await this.tokenService.deleteTokens(userId);
  }
}
