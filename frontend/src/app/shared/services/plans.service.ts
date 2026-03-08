import { Injectable, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export type SessionType =
  | 'easy_run'
  | 'long_run'
  | 'tempo'
  | 'intervals'
  | 'recovery'
  | 'race'
  | 'rest';

export interface TrainingSession {
  id: string;
  weekId: string;
  date: string;
  sessionType: SessionType;
  description: string | null;
  plannedDistanceKm: number | null;
  plannedDurationMin: number | null;
  completed: boolean;
  stravaActivityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingWeek {
  id: string;
  planId: string;
  weekNumber: number;
  startDate: string;
  focus: string | null;
  weeklyVolumeKm: number;
  isTaperWeek: boolean;
  isCutbackWeek: boolean;
  createdAt: string;
}

export interface Race {
  id: string;
  planId: string;
  name: string;
  date: string;
  distanceKm: number;
  type: 'A' | 'B' | 'C';
  location: string | null;
  createdAt: string;
}

export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  goalEvent: string;
  goalDate: string;
  isActive: boolean;
  currentWeeklyVolumeKm: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlanDetail extends TrainingPlan {
  weeks: TrainingWeek[];
  sessions: TrainingSession[];
  races: Race[];
}

export interface CreatePlanPayload {
  name: string;
  goalEvent: string;
  goalDate: string;
  currentWeeklyVolumeKm: number;
  runsPerWeek?: number;
  easyRunDay?: number;
  longRunDay?: number;
  intervalRunDay?: number;
}

export interface UpdateSessionPayload {
  date?: string;
  sessionType?: SessionType;
  description?: string;
  plannedDistanceKm?: number;
  plannedDurationMin?: number;
  completed?: boolean;
}

export const SESSION_TYPE_CONFIG: Record<
  SessionType,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  easy_run:  { label: 'Easy Run',    color: 'text-green-700',  bgColor: 'bg-green-100',  icon: 'directions_run' },
  long_run:  { label: 'Long Run',    color: 'text-blue-700',   bgColor: 'bg-blue-100',   icon: 'timer' },
  tempo:     { label: 'Tempo',       color: 'text-orange-700', bgColor: 'bg-orange-100', icon: 'speed' },
  intervals: { label: 'Intervals',   color: 'text-red-700',    bgColor: 'bg-red-100',    icon: 'repeat' },
  recovery:  { label: 'Recovery',    color: 'text-teal-700',   bgColor: 'bg-teal-100',   icon: 'self_improvement' },
  race:      { label: 'Race',        color: 'text-purple-700', bgColor: 'bg-purple-100', icon: 'emoji_events' },
  rest:      { label: 'Rest',        color: 'text-gray-600',   bgColor: 'bg-gray-100',   icon: 'hotel' },
};

@Injectable({ providedIn: 'root' })
export class PlansService {
  private readonly _plans = signal<TrainingPlan[]>([]);
  private readonly _activePlan = signal<TrainingPlanDetail | null>(null);
  private readonly _loading = signal(false);

  readonly plans = this._plans.asReadonly();
  readonly activePlan = this._activePlan.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor(private readonly api: ApiService) {}

  loadPlans() {
    this._loading.set(true);
    return this.api.get<TrainingPlan[]>('/training-plans').pipe(
      tap({
        next: (plans) => {
          this._plans.set(plans);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      }),
    );
  }

  loadPlan(id: string) {
    return this.api.get<TrainingPlanDetail>(`/training-plans/${id}`);
  }

  createPlan(payload: CreatePlanPayload) {
    return this.api.post<TrainingPlan>('/training-plans', payload).pipe(
      tap((newPlan) => {
        this._plans.update((plans) => [...plans, newPlan]);
      }),
    );
  }

  activatePlan(planId: string) {
    return this.api.patch<TrainingPlan>(`/training-plans/${planId}/activate`, {}).pipe(
      tap((updated) => {
        this._plans.update((plans) =>
          plans.map((p) => ({ ...p, isActive: p.id === updated.id })),
        );
      }),
    );
  }

  deletePlan(planId: string) {
    return this.api.delete<{ message: string }>(`/training-plans/${planId}`).pipe(
      tap(() => {
        this._plans.update((plans) => plans.filter((p) => p.id !== planId));
      }),
    );
  }

  updateSession(planId: string, sessionId: string, payload: UpdateSessionPayload) {
    return this.api.patch<TrainingSession>(
      `/training-plans/${planId}/sessions/${sessionId}`,
      payload,
    );
  }

  /** Group flat sessions array into a map keyed by weekId */
  groupSessionsByWeek(
    sessions: TrainingSession[],
  ): Map<string, TrainingSession[]> {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions) {
      const existing = map.get(s.weekId) ?? [];
      existing.push(s);
      map.set(s.weekId, existing);
    }
    // Sort each week's sessions by date
    for (const [key, val] of map) {
      map.set(key, val.sort((a, b) => a.date.localeCompare(b.date)));
    }
    return map;
  }
}
