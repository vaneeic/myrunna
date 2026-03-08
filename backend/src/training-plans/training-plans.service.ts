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
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../db/database.module';
import {
  trainingPlans,
  trainingWeeks,
  trainingSessions,
  races,
  NewTrainingPlan,
  NewTrainingWeek,
  NewTrainingSession,
} from '../db/schema';
import * as schema from '../db/schema';
import { CreatePlanDto } from './dto/create-plan.dto';

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
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
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

    // Create the plan
    const [plan] = await this.db
      .insert(trainingPlans)
      .values({
        userId,
        name: dto.name,
        goalEvent: dto.goalEvent,
        goalDate: dto.goalDate,
        currentWeeklyVolumeKm: dto.currentWeeklyVolumeKm,
      } as NewTrainingPlan)
      .returning();

    // Generate weeks with progressive overload
    await this.generateWeeks(plan.id, totalWeeks, dto.currentWeeklyVolumeKm, today);

    return plan;
  }

  private async generateWeeks(
    planId: string,
    totalWeeks: number,
    startingVolumeKm: number,
    startDate: Date,
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
      await this.generateSessionsForWeek(week);
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

  private async generateSessionsForWeek(week: {
    id: string;
    weekNumber: number;
    startDate: string;
    weeklyVolumeKm: number;
    isTaperWeek: boolean;
    isCutbackWeek: boolean;
  }) {
    const sessions: NewTrainingSession[] = [];
    const weekStart = new Date(week.startDate);

    // Standard 5-day plan: Mon, Tue, Thu, Sat, Sun
    const schedule: Array<{
      dayOffset: number;
      type: SessionType;
      distanceFraction: number;
      durationMin: number;
      description: string;
    }> = week.isTaperWeek
      ? [
          { dayOffset: 0, type: 'easy_run', distanceFraction: 0.2, durationMin: 30, description: 'Easy shakeout run — keep it very relaxed' },
          { dayOffset: 2, type: 'tempo', distanceFraction: 0.15, durationMin: 25, description: 'Short tempo to maintain sharpness' },
          { dayOffset: 4, type: 'easy_run', distanceFraction: 0.15, durationMin: 20, description: 'Easy legs — trust your training' },
          { dayOffset: 5, type: 'rest', distanceFraction: 0, durationMin: 0, description: 'Complete rest' },
          { dayOffset: 6, type: 'race', distanceFraction: 0, durationMin: 0, description: 'Race day!' },
        ]
      : [
          { dayOffset: 0, type: 'easy_run', distanceFraction: 0.2, durationMin: 40, description: 'Easy aerobic run — conversational pace' },
          { dayOffset: 1, type: 'intervals', distanceFraction: 0.15, durationMin: 45, description: '6x800m at 5km pace with 90s recovery' },
          { dayOffset: 3, type: 'tempo', distanceFraction: 0.2, durationMin: 40, description: '20min tempo at comfortably hard effort (threshold pace)' },
          { dayOffset: 5, type: 'long_run', distanceFraction: 0.35, durationMin: 75, description: 'Long run at easy aerobic pace' },
          { dayOffset: 6, type: 'recovery', distanceFraction: 0.1, durationMin: 25, description: 'Recovery jog — very easy, legs only' },
        ];

    for (const s of schedule) {
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + s.dayOffset);

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

    await this.db
      .delete(trainingPlans)
      .where(eq(trainingPlans.id, planId));

    return { message: 'Plan deleted' };
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
