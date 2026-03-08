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

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly _status = signal<StravaStatus>({ connected: false });
  private readonly _activities = signal<StravaActivity[]>([]);
  private readonly _syncing = signal(false);

  readonly status = this._status.asReadonly();
  readonly activities = this._activities.asReadonly();
  readonly syncing = this._syncing.asReadonly();

  constructor(private readonly api: ApiService) {}

  loadStatus() {
    return this.api.get<StravaStatus>('/strava/status').pipe(
      tap((s) => this._status.set(s)),
    );
  }

  loadActivities(params?: { page?: number; perPage?: number }) {
    return this.api
      .get<StravaActivity[]>('/strava/activities', {
        page: params?.page ?? 1,
        perPage: params?.perPage ?? 20,
      })
      .pipe(tap((acts) => this._activities.set(acts)));
  }

  connect() {
    return this.api.get<{ url: string }>('/strava/connect');
  }

  sync() {
    this._syncing.set(true);
    return this.api.post<SyncResult>('/strava/sync', {}).pipe(
      tap({
        next: () => this._syncing.set(false),
        error: () => this._syncing.set(false),
      }),
    );
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
