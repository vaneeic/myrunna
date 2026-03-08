import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StravaController } from './strava.controller';
import { StravaService } from './strava.service';
import { StravaTokenService } from './strava-token.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    AuthModule,
  ],
  controllers: [StravaController],
  providers: [StravaService, StravaTokenService],
  exports: [StravaService, StravaTokenService],
})
export class StravaModule {}
