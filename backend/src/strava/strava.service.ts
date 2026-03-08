/**
 * StravaService
 *
 * Handles Strava OAuth flow, token refresh, activity sync, and webhooks.
 *
 * Strava API notes:
 * - Access tokens expire after 6 hours — refresh is mandatory
 * - Rate limits: 100 req/15min, 1000 req/day
 * - activity:read_all scope required for private activities
 * - Pagination: max 200 activities per page
 * - Webhook push subscriptions require a publicly accessible verify token
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
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { firstValueFrom } from 'rxjs';
import { StravaTokenService } from './strava-token.service';
import { DATABASE_CONNECTION } from '../db/database.module';
import { stravaActivities, users } from '../db/schema';
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

  // ---------------------------------------------------------------------------
  // OAuth flow
  // ---------------------------------------------------------------------------

  getAuthorizationUrl(userId: string): string {
    const clientId = this.configService.get<string>('STRAVA_CLIENT_ID');
    const redirectUri = this.configService.get<string>('STRAVA_REDIRECT_URI');
    // activity:read_all includes private activities; profile:read_all for name/photo
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

      const athleteName = athlete
        ? `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim()
        : undefined;

      await this.tokenService.saveTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expires_at,
        athleteId: athlete.id,
        athleteName,
        scope: 'read,activity:read_all,profile:read_all',
      });

      this.logger.log(
        `Strava connected for user ${userId}, athlete ${athlete.id} (${athleteName})`,
      );
      return athlete;
    } catch (err) {
      this.logger.error('Failed to exchange Strava code for tokens', err);
      throw new BadRequestException('Failed to connect Strava account');
    }
  }

  // ---------------------------------------------------------------------------
  // Token refresh
  // ---------------------------------------------------------------------------

  /**
   * Get a valid access token, auto-refreshing if within 5 minutes of expiry.
   * This is the single entry point for all Strava API calls.
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
        athleteName: athlete
          ? `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim()
          : (existing!.athleteName ?? undefined),
        scope: existing!.scope,
      });

      this.logger.log(`Refreshed Strava token for user ${userId}`);
      return access_token;
    } catch (err) {
      this.logger.error('Failed to refresh Strava token', err);
      throw new UnauthorizedException(
        'Strava token refresh failed — please reconnect',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Activity sync
  // ---------------------------------------------------------------------------

  /**
   * Syncs Strava activities for a user.
   * Uses `daysBack` for initial/manual syncs.
   * For nightly cron, pass `sinceTimestamp` to only fetch new activities.
   */
  async syncActivities(
    userId: string,
    daysBack = 90,
    sinceTimestamp?: number,
  ): Promise<{ imported: number; updated: number }> {
    const accessToken = await this.getValidAccessToken(userId);

    // If we have a lastSyncedAt, use that; otherwise fall back to daysBack
    const after =
      sinceTimestamp ??
      Math.floor(Date.now() / 1000) - daysBack * 86400;

    let page = 1;
    let imported = 0;
    let updated = 0;

    // Strava max 200 per page; keep paginating until empty page returned
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
        // Only sync running activity types
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

      // If fewer than 200 returned, we're on the last page
      if (activities.length < 200) break;
      page++;
    }

    // Record the sync time so the next nightly sync can use it
    await this.tokenService.updateLastSyncedAt(userId);

    // Calculate and update user's distance-specific paces from recent activities
    await this.updateUserPacesByDistance(userId);

    this.logger.log(
      `Strava sync for user ${userId}: +${imported} imported, ${updated} updated`,
    );
    return { imported, updated };
  }

  /**
   * Calculate user's pace for different distances (5K, 10K, 15K, half marathon)
   * from their recent run activities and update in the users table.
   */
  private async updateUserPacesByDistance(userId: string): Promise<void> {
    try {
      // Get user's recent run activities (last 50, excluding very short runs)
      const activities = await this.db
        .select({
          distance: stravaActivities.distance,
          movingTime: stravaActivities.movingTime,
        })
        .from(stravaActivities)
        .where(
          and(
            eq(stravaActivities.userId, userId),
            eq(stravaActivities.type, 'Run'),
            gte(stravaActivities.distance, 3000), // Min 3km
            lte(stravaActivities.distance, 30000), // Max 30km (exclude ultras)
          ),
        )
        .orderBy(desc(stravaActivities.startDate))
        .limit(50);

      if (activities.length === 0) {
        this.logger.log(`No valid activities found for user ${userId} to calculate paces`);
        return;
      }

      // Helper function to calculate weighted average pace for a distance range
      const calculatePaceForRange = (minMeters: number, maxMeters: number): number | null => {
        const rangeActivities = activities.filter(
          (a) => a.distance >= minMeters && a.distance <= maxMeters,
        );

        if (rangeActivities.length === 0) return null;

        // Take max 10 most recent for this range
        const recentInRange = rangeActivities.slice(0, 10);

        let totalWeightedPace = 0;
        let totalWeight = 0;

        recentInRange.forEach((act, index) => {
          const distanceKm = act.distance / 1000;
          const timeMinutes = act.movingTime / 60;
          const paceMinPerKm = timeMinutes / distanceKm;

          // Weight: most recent = 1.0, oldest = 0.5
          const weight = 1.0 - (index / recentInRange.length) * 0.5;

          totalWeightedPace += paceMinPerKm * weight;
          totalWeight += weight;
        });

        return totalWeightedPace / totalWeight;
      };

      // Calculate distance-specific paces
      const pace5k = calculatePaceForRange(3000, 7000); // 3-7 km
      const pace10k = calculatePaceForRange(8000, 12000); // 8-12 km
      const pace15k = calculatePaceForRange(13000, 18000); // 13-18 km
      const paceHM = calculatePaceForRange(19000, 25000); // 19-25 km

      // Update user's paces (only update non-null values)
      const updates: any = {};
      if (pace5k !== null) updates.pace5kMinPerKm = Math.round(pace5k * 100) / 100;
      if (pace10k !== null) updates.pace10kMinPerKm = Math.round(pace10k * 100) / 100;
      if (pace15k !== null) updates.pace15kMinPerKm = Math.round(pace15k * 100) / 100;
      if (paceHM !== null) updates.paceHalfMarathonMinPerKm = Math.round(paceHM * 100) / 100;

      if (Object.keys(updates).length > 0) {
        await this.db
          .update(users)
          .set(updates)
          .where(eq(users.id, userId));

        this.logger.log(
          `Updated paces for user ${userId}: ` +
          `5K=${pace5k?.toFixed(2) ?? 'N/A'}, ` +
          `10K=${pace10k?.toFixed(2) ?? 'N/A'}, ` +
          `15K=${pace15k?.toFixed(2) ?? 'N/A'}, ` +
          `HM=${paceHM?.toFixed(2) ?? 'N/A'}`,
        );
      } else {
        this.logger.log(`No pace updates available for user ${userId}`);
      }
    } catch (err) {
      this.logger.error(`Failed to update paces for user ${userId}`, err);
      // Don't throw — this is optional enhancement
    }
  }

  /**
   * Syncs all connected users — called by the nightly cron job.
   * Uses lastSyncedAt timestamp so only new activities are fetched.
   */
  async syncAllUsers(): Promise<void> {
    const userIds = await this.tokenService.getAllConnectedUsers();
    this.logger.log(`Nightly sync: ${userIds.length} connected user(s)`);

    for (const userId of userIds) {
      try {
        const tokens = await this.tokenService.getDecryptedTokens(userId);
        if (!tokens) continue;

        // Use lastSyncedAt if available, otherwise fall back to 1 day back
        const sinceTimestamp = tokens.lastSyncedAt
          ? Math.floor(tokens.lastSyncedAt.getTime() / 1000)
          : Math.floor(Date.now() / 1000) - 86400;

        await this.syncActivities(userId, 1, sinceTimestamp);
      } catch (err) {
        // Log but don't fail the whole batch if one user errors
        this.logger.error(`Nightly sync failed for user ${userId}`, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Status & disconnect
  // ---------------------------------------------------------------------------

  async getConnectionStatus(userId: string) {
    const tokens = await this.tokenService.getDecryptedTokens(userId);
    if (!tokens) {
      return { connected: false };
    }
    return {
      connected: true,
      athleteId: tokens.athleteId,
      athleteName: tokens.athleteName,
      scope: tokens.scope,
      expiresAt: tokens.expiresAt,
      lastSyncedAt: tokens.lastSyncedAt,
    };
  }

  async disconnect(userId: string) {
    await this.tokenService.deleteTokens(userId);
  }

  async getActivities(
    userId: string,
    page = 1,
    perPage = 20,
  ) {
    const offset = (page - 1) * perPage;
    return this.db
      .select()
      .from(stravaActivities)
      .where(eq(stravaActivities.userId, userId))
      .orderBy(desc(stravaActivities.startDate))
      .limit(perPage)
      .offset(offset);
  }

  // ---------------------------------------------------------------------------
  // Webhook push subscription
  // ---------------------------------------------------------------------------

  /**
   * Verifies the Strava webhook subscription hub challenge.
   * Strava sends a GET with hub.challenge and hub.verify_token.
   * We must echo back hub.challenge if the verify_token matches.
   */
  verifyWebhookChallenge(
    hubMode: string,
    hubChallenge: string,
    hubVerifyToken: string,
  ): { 'hub.challenge': string } | null {
    const expectedToken = this.configService.get<string>(
      'STRAVA_WEBHOOK_VERIFY_TOKEN',
    );

    if (
      hubMode === 'subscribe' &&
      hubChallenge &&
      hubVerifyToken === expectedToken
    ) {
      this.logger.log('Strava webhook subscription verified');
      return { 'hub.challenge': hubChallenge };
    }

    this.logger.warn(
      `Webhook verification failed — token mismatch or bad mode (mode=${hubMode})`,
    );
    return null;
  }

  /**
   * Handles incoming Strava push events (activity creates/updates/deletes).
   * Strava sends events for the athlete whose token we hold.
   */
  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(
      `Webhook event received: ${event.object_type} ${event.aspect_type} id=${event.object_id}`,
    );

    // Only handle activity events
    if (event.object_type !== 'activity') return;

    const athleteId: number = event.owner_id;
    if (!athleteId) return;

    // Find which user owns this athlete ID
    const userId = await this.findUserByAthleteId(athleteId);
    if (!userId) {
      this.logger.warn(`No user found for Strava athlete ${athleteId}`);
      return;
    }

    if (event.aspect_type === 'create' || event.aspect_type === 'update') {
      // Fetch just this one activity from Strava
      try {
        const accessToken = await this.getValidAccessToken(userId);
        const response = await firstValueFrom(
          this.httpService.get(
            `${STRAVA_API_BASE}/activities/${event.object_id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
        );
        const act = response.data;

        if (!act.type?.toLowerCase().includes('run')) return;

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

        await this.db
          .insert(stravaActivities)
          .values(values)
          .onConflictDoUpdate({
            target: stravaActivities.stravaId,
            set: values,
          });

        this.logger.log(
          `Webhook: upserted activity ${act.id} for user ${userId}`,
        );
      } catch (err) {
        this.logger.error(
          `Webhook: failed to fetch activity ${event.object_id}`,
          err,
        );
      }
    } else if (event.aspect_type === 'delete') {
      await this.db
        .delete(stravaActivities)
        .where(
          eq(stravaActivities.stravaId, String(event.object_id)),
        );
      this.logger.log(
        `Webhook: deleted activity ${event.object_id} for user ${userId}`,
      );
    }
  }

  private async findUserByAthleteId(athleteId: number): Promise<string | null> {
    const { stravaCredentials } = schema;
    const result = await this.db
      .select({ userId: stravaCredentials.userId })
      .from(stravaCredentials)
      .where(eq(stravaCredentials.athleteId, athleteId))
      .limit(1);
    return result[0]?.userId ?? null;
  }
}
