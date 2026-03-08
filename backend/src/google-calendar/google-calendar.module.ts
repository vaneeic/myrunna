import { Module } from '@nestjs/common';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarTokenService } from './google-calendar-token.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, GoogleCalendarTokenService],
  // Export both so TrainingPlansModule can inject GoogleCalendarService
  exports: [GoogleCalendarService, GoogleCalendarTokenService],
})
export class GoogleCalendarModule {}
