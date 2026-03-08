import {
  Controller,
  Get,
  Delete,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleCalendarService } from './google-calendar.service';

@ApiTags('google-calendar')
@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly configService: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // OAuth connect
  // -------------------------------------------------------------------------

  /**
   * Returns the Google OAuth2 consent screen URL.
   * The frontend redirects window.location.href to this URL.
   */
  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Google OAuth2 authorization URL' })
  connect(@CurrentUser() user: { id: string }) {
    const url = this.googleCalendarService.getAuthorizationUrl(user.id);
    return { url };
  }

  /**
   * Google redirects here after the user grants (or denies) access.
   * Exchanges the auth code for tokens, creates the MyRunna calendar,
   * then redirects the browser back to the frontend settings page.
   */
  @Get('callback')
  @ApiOperation({ summary: 'Google OAuth2 callback — exchange code for tokens' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'state', required: true, description: 'User ID passed via OAuth state' })
  @ApiQuery({ name: 'error', required: false })
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';

    if (error) {
      return res.redirect(`${frontendUrl}/settings?gcal=denied`);
    }

    if (!code || !userId) {
      return res.redirect(`${frontendUrl}/settings?gcal=error`);
    }

    try {
      await this.googleCalendarService.connectUser(userId, code);
      return res.redirect(`${frontendUrl}/settings?gcal=connected`);
    } catch {
      return res.redirect(`${frontendUrl}/settings?gcal=error`);
    }
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Google Calendar connection status for current user' })
  getStatus(@CurrentUser() user: { id: string }) {
    return this.googleCalendarService.getConnectionStatus(user.id);
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  @Delete('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Google Calendar — revokes token and deletes MyRunna calendar' })
  async disconnect(@CurrentUser() user: { id: string }) {
    await this.googleCalendarService.disconnect(user.id);
    return { message: 'Google Calendar disconnected' };
  }
}
