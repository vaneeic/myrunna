import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Delete,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StravaService } from './strava.service';

@ApiTags('strava')
@Controller('strava')
export class StravaController {
  constructor(
    private readonly stravaService: StravaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Strava OAuth authorization URL' })
  connect(@CurrentUser() user: { id: string }) {
    const url = this.stravaService.getAuthorizationUrl(user.id);
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Strava OAuth callback — exchanges code for tokens' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true, description: 'User ID passed via OAuth state' })
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    if (error) {
      return res.redirect(`${frontendUrl}/settings?strava=denied`);
    }

    try {
      await this.stravaService.exchangeCodeForTokens(code, userId);
      return res.redirect(`${frontendUrl}/settings?strava=connected`);
    } catch {
      return res.redirect(`${frontendUrl}/settings?strava=error`);
    }
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Strava connection status for current user' })
  getStatus(@CurrentUser() user: { id: string }) {
    return this.stravaService.getConnectionStatus(user.id);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Manually trigger Strava activity sync (last 30 days)' })
  sync(@CurrentUser() user: { id: string }) {
    return this.stravaService.syncActivities(user.id, 30);
  }

  @Delete('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disconnect Strava account' })
  async disconnect(@CurrentUser() user: { id: string }) {
    await this.stravaService.disconnect(user.id);
    return { message: 'Strava account disconnected' };
  }
}
