import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StravaModule } from './strava/strava.module';
import { TrainingPlansModule } from './training-plans/training-plans.module';
import { HealthModule } from './health/health.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    StravaModule,
    TrainingPlansModule,
    HealthModule,
    GoogleCalendarModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
