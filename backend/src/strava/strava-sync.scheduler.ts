/**
 * StravaSyncScheduler
 *
 * Runs a nightly cron job at 02:00 to sync Strava activities for all
 * connected users. Uses @nestjs/schedule's @Cron decorator.
 *
 * The scheduler only processes users whose tokens are present; invalid
 * or expired tokens are refreshed automatically inside syncAllUsers().
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StravaService } from './strava.service';

@Injectable()
export class StravaSyncScheduler {
  private readonly logger = new Logger(StravaSyncScheduler.name);

  constructor(private readonly stravaService: StravaService) {}

  /**
   * Nightly at 02:00 — sync Strava activities for every connected user.
   * Uses lastSyncedAt so only new/updated activities since the previous
   * sync are fetched, keeping API usage well within rate limits.
   */
  @Cron('0 2 * * *', { name: 'nightly-strava-sync', timeZone: 'UTC' })
  async handleNightlySync() {
    this.logger.log('Nightly Strava sync started');
    try {
      await this.stravaService.syncAllUsers();
      this.logger.log('Nightly Strava sync completed');
    } catch (err) {
      this.logger.error('Nightly Strava sync encountered an error', err);
    }
  }
}
