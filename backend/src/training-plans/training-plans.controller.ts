import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TrainingPlansService } from './training-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@ApiTags('training-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('training-plans')
export class TrainingPlansController {
  constructor(private readonly plansService: TrainingPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List all training plans for current user' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.plansService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a training plan with all weeks and sessions' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.plansService.findOne(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new training plan with auto-generated sessions' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePlanDto,
  ) {
    return this.plansService.create(user.id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Set a training plan as the active plan' })
  setActive(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.plansService.setActive(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a training plan' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.plansService.delete(id, user.id);
  }

  @Patch(':id/sessions/:sessionId')
  @ApiOperation({ summary: 'Update a single training session (for drag-and-drop edits and completion marking)' })
  updateSession(
    @Param('id') planId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSessionDto,
  ) {
    return this.plansService.updateSession(planId, sessionId, user.id, dto);
  }
}
