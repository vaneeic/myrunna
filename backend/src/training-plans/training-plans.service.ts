/**
 * TrainingPlansService
 *
 * Core plan generation logic:
 * - Progressive overload: +10% volume per week
 * - Cutback weeks every 4th week (70% of peak volume)
 * - Taper weeks: 2 weeks before A-race (50% then 30% volume)
 * - B/C race weeks flagged as taper weeks automatically
 */
import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../db/database.module';
import {
  trainingPlans,
  trainingWeeks,
  trainingSessions,
  races,
  users,
  NewTrainingPlan,
  NewTrainingWeek,
  NewTrainingSession,
} from '../db/schema';
import * as schema from '../db/schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

type SessionType =
  | 'easy_run'
  | 'long_run'
  | 'tempo'
  | 'intervals'
  | 'recovery'
  | 'race'
  | 'rest';

@Injectable()
export class TrainingPlansService {
  private readonly logger = new Logger(TrainingPlansService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async findAllForUser(userId: string) {
    return this.db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.userId, userId));
  }

  async findOne(planId: string, userId: string) {
    const plan = await this.db
      .select()
      .from(trainingPlans)
      .where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)))
      .limit(1);

    if (!plan[0]) throw new NotFoundException('Training plan not found');

    const weeks = await this.db
      .select()
      .from(trainingWeeks)
      .where(eq(trainingWeeks.planId, planId));

    const weekIds = weeks.map((w) => w.id);
    const sessions = weekIds.length
      ? await this.db
          .select()
          .from(trainingSessions)
          .where(inArray(trainingSessions.weekId, weekIds))
      : [];

    const planRaces = await this.db
      .select()
      .from(races)
      .where(eq(races.planId, planId));

    return { ...plan[0], weeks, sessions, races: planRaces };
  }

  async create(userId: string, dto: CreatePlanDto) {
    const goalDate = new Date(dto.goalDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalWeeks = Math.max(
      4,
      Math.ceil(
        (goalDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000),
      ),
    );

    // Create the plan with preferences
    const [plan] = await this.db
      .insert(trainingPlans)
      .values({
        userId,
        name: dto.name,
        goalEvent: dto.goalEvent,
        goalDate: dto.goalDate,
        currentWeeklyVolumeKm: dto.currentWeeklyVolumeKm,
        runsPerWeek: dto.runsPerWeek ?? 3,
        easyRunDay: dto.easyRunDay,
        longRunDay: dto.longRunDay,
        intervalRunDay: dto.intervalRunDay,
      } as NewTrainingPlan)
      .returning();

    // Generate weeks with progressive overload
    await this.generateWeeks(plan.id, totalWeeks, dto.currentWeeklyVolumeKm, today, userId, {
      runsPerWeek: plan.runsPerWeek,
      easyRunDay: plan.easyRunDay,
      longRunDay: plan.longRunDay,
      intervalRunDay: plan.intervalRunDay,
    });

    // Sync to Google Calendar if the user has it connected (fire-and-forget)
    this.googleCalendarService.syncPlanToCalendar(userId, plan.id).catch((err) => {
      this.logger.error(`Google Calendar sync failed for plan ${plan.id}`, err);
    });

    return plan;
  }

  private async generateWeeks(
    planId: string,
    totalWeeks: number,
    startingVolumeKm: number,
    startDate: Date,
    userId: string,
    preferences: {
      runsPerWeek: number;
      easyRunDay?: number | null;
      longRunDay?: number | null;
      intervalRunDay?: number | null;
    },
  ) {
    const weeks: NewTrainingWeek[] = [];
    let currentVolume = startingVolumeKm;
    let peakVolume = startingVolumeKm;

    const taperWeeks = Math.min(3, Math.floor(totalWeeks * 0.15));
    const buildWeeks = totalWeeks - taperWeeks;

    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + i * 7);

      const isCutback = i > 0 && (i + 1) % 4 === 0 && i < buildWeeks;
      const isTaper = i >= buildWeeks;

      let weekVolume: number;
      if (isTaper) {
        const taperWeekIndex = i - buildWeeks;
        const taperReduction = [0.5, 0.3, 0.2];
        weekVolume = peakVolume * (taperReduction[taperWeekIndex] ?? 0.2);
      } else if (isCutback) {
        weekVolume = currentVolume * 0.7;
      } else {
        weekVolume = Math.min(currentVolume * 1.1, currentVolume + 5);
        peakVolume = Math.max(peakVolume, weekVolume);
      }

      currentVolume = weekVolume;

      weeks.push({
        planId,
        weekNumber: i + 1,
        startDate: weekStart.toISOString().split('T')[0],
        weeklyVolumeKm: Math.round(weekVolume * 10) / 10,
        isTaperWeek: isTaper,
        isCutbackWeek: isCutback,
        focus: this.getWeekFocus(i, totalWeeks, isTaper, isCutback),
      });
    }

    const insertedWeeks = await this.db
      .insert(trainingWeeks)
      .values(weeks)
      .returning();

    // Generate sessions for each week
    for (const week of insertedWeeks) {
      await this.generateSessionsForWeek(week, userId, preferences);
    }
  }

  private getWeekFocus(
    weekIndex: number,
    totalWeeks: number,
    isTaper: boolean,
    isCutback: boolean,
  ): string {
    if (isTaper) return 'Taper — stay fresh';
    if (isCutback) return 'Recovery week — consolidate fitness';
    if (weekIndex < totalWeeks * 0.3) return 'Base building — aerobic foundation';
    if (weekIndex < totalWeeks * 0.6) return 'Build — increasing intensity';
    return 'Peak — race-specific fitness';
  }

  private async generateSessionsForWeek(
    week: {
      id: string;
      weekNumber: number;
      startDate: string;
      weeklyVolumeKm: number;
      isTaperWeek: boolean;
      isCutbackWeek: boolean;
    },
    userId: string,
    preferences: {
      runsPerWeek: number;
      easyRunDay?: number | null;
      longRunDay?: number | null;
      intervalRunDay?: number | null;
    },
  ) {
    // Fetch user's distance-specific paces from Strava data
    const user = await this.db
      .select({ 
        pace5k: users.pace5kMinPerKm,
        pace10k: users.pace10kMinPerKm,
        pace15k: users.pace15kMinPerKm,
        paceHM: users.paceHalfMarathonMinPerKm,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Helper to select appropriate pace for a given distance
    const getPaceForDistance = (distanceKm: number): number => {
      const userPaces = user[0];
      if (!userPaces) return 5.5; // Ultimate fallback: 5:30 min/km

      // Select pace based on distance, with fallbacks
      if (distanceKm < 8) {
        return userPaces.pace5k ?? userPaces.pace10k ?? userPaces.pace15k ?? userPaces.paceHM ?? 5.5;
      } else if (distanceKm < 13) {
        return userPaces.pace10k ?? userPaces.pace5k ?? userPaces.pace15k ?? userPaces.paceHM ?? 5.5;
      } else if (distanceKm < 19) {
        return userPaces.pace15k ?? userPaces.pace10k ?? userPaces.paceHM ?? userPaces.pace5k ?? 5.5;
      } else {
        return userPaces.paceHM ?? userPaces.pace15k ?? userPaces.pace10k ?? userPaces.pace5k ?? 5.5;
      }
    };

    const sessions: NewTrainingSession[] = [];
    const weekStart = new Date(week.startDate);

    // Build schedule based on preferences
    const schedule: Array<{
      dayOffset: number;
      type: SessionType;
      distanceFraction: number;
      durationMin: number;
      description: string;
    }> = [];

    if (week.isTaperWeek) {
      // Taper week schedule (race week)
      const easyDay = preferences.easyRunDay ?? 2; // Default Tuesday
      
      const taperedVolume = week.weeklyVolumeKm;
      const easyRunDistance = taperedVolume * 0.2;
      const tempoDistance = taperedVolume * 0.15;
      const shakeoutDistance = taperedVolume * 0.15;
      
      schedule.push(
        { 
          dayOffset: easyDay, 
          type: 'easy_run', 
          distanceFraction: 0.2, 
          durationMin: Math.round(easyRunDistance * getPaceForDistance(easyRunDistance) * 1.1), 
          description: 'Easy shakeout run — keep it very relaxed' 
        },
        { 
          dayOffset: (easyDay + 2) % 7, 
          type: 'tempo', 
          distanceFraction: 0.15, 
          durationMin: Math.round(tempoDistance * getPaceForDistance(tempoDistance) * 0.9), 
          description: 'Short tempo to maintain sharpness' 
        },
        { 
          dayOffset: (easyDay + 3) % 7, 
          type: 'easy_run', 
          distanceFraction: 0.15, 
          durationMin: Math.round(shakeoutDistance * getPaceForDistance(shakeoutDistance) * 1.1), 
          description: 'Easy legs — trust your training' 
        },
        { dayOffset: 5, type: 'rest', distanceFraction: 0, durationMin: 0, description: 'Complete rest' },
        { dayOffset: 6, type: 'race', distanceFraction: 0, durationMin: 0, description: 'Race day!' },
      );
    } else {
      // Regular training week
      const runsPerWeek = preferences.runsPerWeek;
      
      // Use user preferences or defaults (Tuesday=2, Sunday=0, Thursday=4)
      const easyDay = preferences.easyRunDay ?? 2;
      const longDay = preferences.longRunDay ?? 0;
      const intervalDay = preferences.intervalRunDay ?? 4;

      if (runsPerWeek === 3) {
        // 3-day schedule: easy, long, interval/tempo
        const easyDistance = week.weeklyVolumeKm * 0.3;
        const intervalDistance = week.weeklyVolumeKm * 0.25;
        const longDistance = week.weeklyVolumeKm * 0.45;
        
        schedule.push(
          { 
            dayOffset: easyDay, 
            type: 'easy_run', 
            distanceFraction: 0.3, 
            durationMin: Math.round(easyDistance * getPaceForDistance(easyDistance) * 1.1), 
            description: 'Easy aerobic run — conversational pace' 
          },
          { 
            dayOffset: intervalDay, 
            type: 'intervals', 
            distanceFraction: 0.25, 
            durationMin: Math.round(intervalDistance * getPaceForDistance(intervalDistance) * 0.8), 
            description: '6x800m at 5km pace with 90s recovery' 
          },
          { 
            dayOffset: longDay, 
            type: 'long_run', 
            distanceFraction: 0.45, 
            durationMin: Math.round(longDistance * getPaceForDistance(longDistance)), 
            description: 'Long run at easy aerobic pace' 
          },
        );
      } else if (runsPerWeek === 4) {
        // 4-day schedule: easy, tempo, long, recovery
        const easyDistance = week.weeklyVolumeKm * 0.25;
        const tempoDistance = week.weeklyVolumeKm * 0.2;
        const longDistance = week.weeklyVolumeKm * 0.4;
        const recoveryDistance = week.weeklyVolumeKm * 0.15;
        
        schedule.push(
          { 
            dayOffset: easyDay, 
            type: 'easy_run', 
            distanceFraction: 0.25, 
            durationMin: Math.round(easyDistance * getPaceForDistance(easyDistance) * 1.1), 
            description: 'Easy aerobic run — conversational pace' 
          },
          { 
            dayOffset: intervalDay, 
            type: 'tempo', 
            distanceFraction: 0.2, 
            durationMin: Math.round(tempoDistance * getPaceForDistance(tempoDistance) * 0.9), 
            description: '20min tempo at comfortably hard effort (threshold pace)' 
          },
          { 
            dayOffset: longDay, 
            type: 'long_run', 
            distanceFraction: 0.4, 
            durationMin: Math.round(longDistance * getPaceForDistance(longDistance)), 
            description: 'Long run at easy aerobic pace' 
          },
          { 
            dayOffset: (longDay + 1) % 7, 
            type: 'recovery', 
            distanceFraction: 0.15, 
            durationMin: Math.round(recoveryDistance * getPaceForDistance(recoveryDistance) * 1.15), 
            description: 'Recovery jog — very easy, legs only' 
          },
        );
      } else {
        // 5+ day schedule: full program
        const easyDistance = week.weeklyVolumeKm * 0.2;
        const intervalDistance = week.weeklyVolumeKm * 0.15;
        const tempoDistance = week.weeklyVolumeKm * 0.2;
        const longDistance = week.weeklyVolumeKm * 0.35;
        const recoveryDistance = week.weeklyVolumeKm * 0.1;
        
        schedule.push(
          { 
            dayOffset: (longDay + 1) % 7, 
            type: 'easy_run', 
            distanceFraction: 0.2, 
            durationMin: Math.round(easyDistance * getPaceForDistance(easyDistance) * 1.1), 
            description: 'Easy aerobic run — conversational pace' 
          },
          { 
            dayOffset: easyDay, 
            type: 'intervals', 
            distanceFraction: 0.15, 
            durationMin: Math.round(intervalDistance * getPaceForDistance(intervalDistance) * 0.8), 
            description: '6x800m at 5km pace with 90s recovery' 
          },
          { 
            dayOffset: intervalDay, 
            type: 'tempo', 
            distanceFraction: 0.2, 
            durationMin: Math.round(tempoDistance * getPaceForDistance(tempoDistance) * 0.9), 
            description: '20min tempo at comfortably hard effort (threshold pace)' 
          },
          { 
            dayOffset: longDay, 
            type: 'long_run', 
            distanceFraction: 0.35, 
            durationMin: Math.round(longDistance * getPaceForDistance(longDistance)), 
            description: 'Long run at easy aerobic pace' 
          },
          { 
            dayOffset: (longDay + 1) % 7, 
            type: 'recovery', 
            distanceFraction: 0.1, 
            durationMin: Math.round(recoveryDistance * getPaceForDistance(recoveryDistance) * 1.15), 
            description: 'Recovery jog — very easy, legs only' 
          },
        );
      }
    }

    for (const s of schedule) {
      // Calculate the actual date for this day of week
      // s.dayOffset is day of week (0=Sunday, 6=Saturday)
      const weekStartDay = weekStart.getDay(); // 0=Sunday, 6=Saturday
      let daysToAdd = s.dayOffset - weekStartDay;
      
      // If the target day is before the week start day, add 7 to get next week's instance
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + daysToAdd);

      sessions.push({
        weekId: week.id,
        date: sessionDate.toISOString().split('T')[0],
        sessionType: s.type,
        description: s.description,
        plannedDistanceKm:
          s.distanceFraction > 0
            ? Math.round(week.weeklyVolumeKm * s.distanceFraction * 10) / 10
            : null,
        plannedDurationMin: s.durationMin > 0 ? s.durationMin : null,
        completed: false,
      });
    }

    await this.db.insert(trainingSessions).values(sessions);
  }

  async delete(planId: string, userId: string) {
    const plan = await this.db
      .select({ id: trainingPlans.id })
      .from(trainingPlans)
      .where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)))
      .limit(1);

    if (!plan[0]) throw new NotFoundException('Training plan not found');

    // Delete Google Calendar events before removing from DB (fire-and-forget)
    this.googleCalendarService.deletePlanEvents(userId, planId).catch((err) => {
      this.logger.error(`Google Calendar cleanup failed for plan ${planId}`, err);
    });

    await this.db
      .delete(trainingPlans)
      .where(eq(trainingPlans.id, planId));

    return { message: 'Plan deleted' };
  }

  async updateSession(
    planId: string,
    sessionId: string,
    userId: string,
    dto: UpdateSessionDto,
  ) {
    // Verify the plan belongs to this user
    const plan = await this.db
      .select({ id: trainingPlans.id })
      .from(trainingPlans)
      .where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)))
      .limit(1);

    if (!plan[0]) throw new NotFoundException('Training plan not found');

    // Verify the session exists and belongs to a week of this plan
    const session = await this.db
      .select({
        id: trainingSessions.id,
        weekId: trainingSessions.weekId,
      })
      .from(trainingSessions)
      .innerJoin(trainingWeeks, eq(trainingWeeks.id, trainingSessions.weekId))
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingWeeks.planId, planId),
        ),
      )
      .limit(1);

    if (!session[0]) throw new NotFoundException('Session not found');

    const updateData: Partial<typeof trainingSessions.$inferInsert> = {};
    if (dto.date !== undefined) {
      updateData.date = dto.date;
      // Find the week containing the new date and reassign weekId
      const allWeeks = await this.db
        .select()
        .from(trainingWeeks)
        .where(eq(trainingWeeks.planId, planId));
      const targetWeek = allWeeks.find((w) => {
        const weekStart = new Date(w.startDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const targetDate = new Date(dto.date!);
        return targetDate >= weekStart && targetDate <= weekEnd;
      });
      if (targetWeek) updateData.weekId = targetWeek.id;
    }
    if (dto.sessionType !== undefined) updateData.sessionType = dto.sessionType;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.plannedDistanceKm !== undefined) updateData.plannedDistanceKm = dto.plannedDistanceKm;
    if (dto.plannedDurationMin !== undefined) updateData.plannedDurationMin = dto.plannedDurationMin;
    if (dto.completed !== undefined) updateData.completed = dto.completed;

    const [updated] = await this.db
      .update(trainingSessions)
      .set(updateData)
      .where(eq(trainingSessions.id, sessionId))
      .returning();

    // Update the Google Calendar event (fire-and-forget)
    this.googleCalendarService.updateSession(userId, sessionId, planId).catch((err) => {
      this.logger.error(
        `Google Calendar update failed for session ${sessionId}`,
        err,
      );
    });

    return updated;
  }

  async setActive(planId: string, userId: string) {
    // Deactivate all other plans for user
    await this.db
      .update(trainingPlans)
      .set({ isActive: false })
      .where(eq(trainingPlans.userId, userId));

    const [updated] = await this.db
      .update(trainingPlans)
      .set({ isActive: true })
      .where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)))
      .returning();

    if (!updated) throw new NotFoundException('Training plan not found');
    return updated;
  }
}
