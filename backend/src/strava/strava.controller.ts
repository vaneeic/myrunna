import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
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

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Strava OAuth authorization URL' })
  connect(@CurrentUser() user: { id: string }) {
    const url = this.stravaService.getAuthorizationUrl(user.id);
    return { url };
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Strava OAuth callback — exchanges code for tokens',
  })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'User ID passed via OAuth state param',
  })
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

  // -------------------------------------------------------------------------
  // Status & disconnect
  // -------------------------------------------------------------------------

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Strava connection status for current user' })
  getStatus(@CurrentUser() user: { id: string }) {
    return this.stravaService.getConnectionStatus(user.id);
  }

  @Delete('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disconnect Strava account' })
  async disconnect(@CurrentUser() user: { id: string }) {
    await this.stravaService.disconnect(user.id);
    return { message: 'Strava account disconnected' };
  }

  // -------------------------------------------------------------------------
  // Activity sync
  // -------------------------------------------------------------------------

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Manually trigger Strava activity sync (last 90 days)' })
  sync(@CurrentUser() user: { id: string }) {
    return this.stravaService.syncActivities(user.id, 90);
  }

  @Get('activities')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List synced Strava activities for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  getActivities(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    return this.stravaService.getActivities(user.id, page, perPage);
  }

  // -------------------------------------------------------------------------
  // Webhook push subscription
  // -------------------------------------------------------------------------

  /**
   * GET /api/strava/webhook
   *
   * Strava sends a hub challenge to this endpoint when you create a push
   * subscription. Respond with { "hub.challenge": "<value>" } to confirm.
   *
   * Required env var: STRAVA_WEBHOOK_VERIFY_TOKEN (any random string you
   * set in the Strava subscription creation request).
   */
  @Get('webhook')
  @ApiOperation({
    summary: 'Strava webhook hub challenge verification (hub.mode=subscribe)',
  })
  @ApiQuery({ name: 'hub.mode', required: true })
  @ApiQuery({ name: 'hub.challenge', required: true })
  @ApiQuery({ name: 'hub.verify_token', required: true })
  verifyWebhook(
    @Query('hub.mode') hubMode: string,
    @Query('hub.challenge') hubChallenge: string,
    @Query('hub.verify_token') hubVerifyToken: string,
    @Res() res: Response,
  ) {
    const result = this.stravaService.verifyWebhookChallenge(
      hubMode,
      hubChallenge,
      hubVerifyToken,
    );

    if (!result) {
      throw new ForbiddenException('Webhook verification failed');
    }

    // Strava requires a 200 with the JSON body, not a redirect
    return res.status(HttpStatus.OK).json(result);
  }

  /**
   * POST /api/strava/webhook
   *
   * Receives push events (activity create/update/delete).
   * Strava expects a 200 within 2 seconds — processing is fire-and-forget.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Strava push subscription events' })
  @ApiBody({ description: 'Strava push event payload', type: Object })
  receiveWebhook(@Body() event: any) {
    // Acknowledge immediately — Strava requires 200 within 2 seconds
    // Run the actual processing asynchronously
    void this.stravaService.handleWebhookEvent(event);
    return { received: true };
  }
}
