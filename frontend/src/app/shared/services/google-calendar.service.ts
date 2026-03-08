import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';

export interface GoogleCalendarStatus {
  connected: boolean;
  calendarName?: string;
  calendarId?: string;
  lastSyncedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  private readonly _status = signal<GoogleCalendarStatus>({ connected: false });
  private readonly _connecting = signal(false);

  readonly status = this._status.asReadonly();
  readonly connecting = this._connecting.asReadonly();

  constructor(private readonly api: ApiService) {}

  loadStatus() {
    return this.api.get<GoogleCalendarStatus>('/google-calendar/status').pipe(
      tap((s) => this._status.set(s)),
    );
  }

  connect() {
    this._connecting.set(true);
    return this.api.get<{ url: string }>('/google-calendar/connect').pipe(
      tap({
        next: () => this._connecting.set(false),
        error: () => this._connecting.set(false),
      }),
    );
  }

  disconnect() {
    return this.api.delete<{ message: string }>('/google-calendar/disconnect').pipe(
      tap(() => this._status.set({ connected: false })),
    );
  }
}
