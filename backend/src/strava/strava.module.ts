import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { StravaController } from './strava.controller';
import { StravaService } from './strava.service';
import { StravaTokenService } from './strava-token.service';
import { StravaSyncScheduler } from './strava-sync.scheduler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    AuthModule,
    // ScheduleModule must be imported in at least one module; importing here
    // keeps all schedule-related code co-located with the Strava feature.
    ScheduleModule.forRoot(),
  ],
  controllers: [StravaController],
  providers: [StravaService, StravaTokenService, StravaSyncScheduler],
  exports: [StravaService, StravaTokenService],
})
export class StravaModule {}
