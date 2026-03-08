import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';

export interface StravaStatus {
  connected: boolean;
  athleteId?: number;
  athleteName?: string;
  scope?: string;
  expiresAt?: number;
  lastSyncedAt?: string | null;
}

export interface SyncResult {
  imported: number;
  updated: number;
}

export interface StravaActivity {
  id: string;
  stravaId: string;
  name: string;
  type: string;
  distance: number;       // metres
  movingTime: number;     // seconds
  elapsedTime: number;    // seconds
  startDate: string;
  averageHeartrate?: number;
  maxHeartrate?: number;
  averageCadence?: number;
  sufferScore?: number;
}

export interface ActivitiesResponse {
  activities: StravaActivity[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly _status = signal<StravaStatus>({ connected: false });
  private readonly _activities = signal<StravaActivity[]>([]);
  private readonly _totalActivities = signal(0);
  private readonly _syncing = signal(false);

  readonly status = this._status.asReadonly();
  readonly activities = this._activities.asReadonly();
  readonly totalActivities = this._totalActivities.asReadonly();
  readonly syncing = this._syncing.asReadonly();

  constructor(private readonly api: ApiService) {}

  loadStatus() {
    return this.api.get<StravaStatus>('/strava/status').pipe(
      tap((s) => this._status.set(s)),
    );
  }

  loadActivities(params?: { page?: number; perPage?: number }) {
    return this.api
      .get<ActivitiesResponse>('/strava/activities', {
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 20,
      })
      .pipe(
        tap((response) => {
          this._activities.set(response.activities);
          this._totalActivities.set(response.total);
        })
      );
  }

  connect() {
    return this.api.get<{ url: string }>('/strava/connect');
  }

  sync(options?: {
    daysBack?: number;
    afterDate?: string;
    beforeDate?: string;
  }) {
    this._syncing.set(true);
    
    const params: any = {};
    if (options?.daysBack !== undefined) params.daysBack = options.daysBack;
    if (options?.afterDate) params.afterDate = options.afterDate;
    if (options?.beforeDate) params.beforeDate = options.beforeDate;
    
    return this.api.post<SyncResult>('/strava/sync', {}, params).pipe(
      tap({
        next: () => this._syncing.set(false),
        error: () => this._syncing.set(false),
      }),
    );
  }

  recalculatePaces() {
    return this.api.post<any>('/strava/recalculate-paces', {});
  }

  disconnect() {
    return this.api.delete<{ message: string }>('/strava/disconnect').pipe(
      tap(() => {
        this._status.set({ connected: false });
        this._activities.set([]);
      }),
    );
  }
}
