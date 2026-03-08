export type RaceType = 'A' | 'B' | 'C';

export type SessionType =
  | 'easy_run'
  | 'long_run'
  | 'tempo'
  | 'intervals'
  | 'recovery'
  | 'race'
  | 'rest';

export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  goalEvent: string;
  goalDate: Date;
  createdAt: Date;
  isActive: boolean;
  runsPerWeek: number;
  easyRunDay?: number | null;
  longRunDay?: number | null;
  intervalRunDay?: number | null;
}

export interface Race {
  id: string;
  planId: string;
  name: string;
  date: Date;
  distanceKm: number;
  type: RaceType;
  location?: string;
}

export interface TrainingWeek {
  id: string;
  planId: string;
  weekNumber: number;
  startDate: Date;
  focus?: string;
  weeklyVolumeKm: number;
  isTaperWeek: boolean;
  isCutbackWeek: boolean;
}

export interface TrainingSession {
  id: string;
  weekId: string;
  date: Date;
  sessionType: SessionType;
  description?: string;
  plannedDistanceKm?: number;
  plannedDurationMin?: number;
  completed: boolean;
  stravaActivityId?: string;
}

export interface CreateTrainingPlanRequest {
  name: string;
  goalEvent: string;
  goalDate: string; // ISO date string
  currentWeeklyVolumeKm: number;
  runsPerWeek?: number;
  easyRunDay?: number;
  longRunDay?: number;
  intervalRunDay?: number;
}

export interface PlanSummary extends TrainingPlan {
  totalWeeks: number;
  completedSessions: number;
  totalSessions: number;
  races: Race[];
}
