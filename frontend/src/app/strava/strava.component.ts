import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StravaService, StravaActivity } from '../shared/services/strava.service';
import { ShareCardComponent } from './share-card/share-card.component';

@Component({
  selector: 'app-strava',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
    ShareCardComponent,
  ],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-start justify-between mb-5">
        <div>
          <h1 class="text-2xl font-bold">Activities</h1>
          @if (strava.status().lastSyncedAt) {
            <p class="text-xs text-gray-400 mt-0.5">
              Last synced: {{ strava.status().lastSyncedAt | date:'medium' }}
            </p>
          }
        </div>
        <button mat-stroked-button (click)="syncActivities()" [disabled]="strava.syncing()"
          style="color:#e91e8c;border-color:#e91e8c" class="flex-shrink-0">
          @if (strava.syncing()) {
            <mat-spinner diameter="16" style="--mdc-circular-progress-active-indicator-color:#e91e8c"></mat-spinner>
            Syncing…
          } @else {
            <mat-icon>sync</mat-icon> Sync
          }
        </button>
      </div>

      <!-- Not connected banner -->
      @if (strava.status().connected === false) {
        <div class="rounded-2xl bg-orange-50 border border-orange-200 p-5 flex gap-4 items-start mb-5">
          <mat-icon style="color:#FC4C02;flex-shrink:0">fitness_center</mat-icon>
          <div>
            <p class="font-semibold text-gray-800 text-sm">Strava not connected</p>
            <p class="text-gray-500 text-xs mt-0.5 mb-3">Connect your Strava account to sync runs automatically.</p>
            <a mat-raised-button routerLink="/settings" style="background:#FC4C02;color:white;font-size:13px">
              Connect Strava
            </a>
          </div>
        </div>
      }

      <!-- Activity cards -->
      @if (strava.activities().length > 0) {

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          @for (a of strava.activities(); track a.id) {
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">

              <!-- Top row: name + share -->
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-900 text-sm leading-tight truncate">{{ a.name }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ a.startDate | date:'d MMM yyyy' }}</p>
                </div>
                <button class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100 hover:bg-pink-50 hover:border-pink-200 transition-colors"
                  [disabled]="sharingId() === a.id"
                  matTooltip="Create share card"
                  (click)="openShareCard(a)"
                  style="color:#e91e8c;background:transparent">
                  @if (sharingId() === a.id) {
                    <mat-spinner diameter="14" style="--mdc-circular-progress-active-indicator-color:#e91e8c"></mat-spinner>
                  } @else {
                    <mat-icon class="!w-4 !h-4 text-base">ios_share</mat-icon>
                  }
                </button>
              </div>

              <!-- Stats row -->
              <div class="grid grid-cols-4 gap-1 pt-2 border-t border-gray-50">
                <div class="flex flex-col items-center">
                  <span class="text-[10px] text-gray-400 uppercase tracking-wide">Dist</span>
                  <span class="text-sm font-bold text-gray-800 mt-0.5">{{ (a.distance / 1000) | number:'1.1-1' }}</span>
                  <span class="text-[10px] text-gray-400">km</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-[10px] text-gray-400 uppercase tracking-wide">Pace</span>
                  <span class="text-sm font-bold text-gray-800 mt-0.5">{{ formatPace(a.distance, a.movingTime) }}</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-[10px] text-gray-400 uppercase tracking-wide">Time</span>
                  <span class="text-sm font-bold text-gray-800 mt-0.5">{{ formatTime(a.movingTime) }}</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-[10px] text-gray-400 uppercase tracking-wide">HR</span>
                  @if (a.averageHeartrate) {
                    <span class="text-sm font-bold text-gray-800 mt-0.5">{{ a.averageHeartrate | number:'1.0-0' }}</span>
                    <span class="text-[10px] text-gray-400">bpm</span>
                  } @else {
                    <span class="text-sm font-bold text-gray-300 mt-0.5">—</span>
                  }
                </div>
              </div>

            </div>
          }
        </div>

        <!-- Pagination -->
        <mat-paginator
          [length]="strava.totalActivities()"
          [pageSize]="pageSize()"
          [pageIndex]="currentPage()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>

      } @else {
        <div class="rounded-2xl bg-white border border-gray-100 p-10 text-center">
          <mat-icon class="text-gray-300 mb-3" style="font-size:48px;width:48px;height:48px;">directions_run</mat-icon>
          <p class="text-gray-500 text-sm mb-4">No activities found.</p>
          @if (strava.status().connected) {
            <button mat-raised-button (click)="syncActivities()" style="background:#e91e8c;color:white">
              <mat-icon>sync</mat-icon> Sync Now
            </button>
          } @else {
            <a mat-raised-button routerLink="/settings" style="background:#FC4C02;color:white">
              Connect Strava
            </a>
          }
        </div>
      }
    </div>

    <!-- Share card modal -->
    @if (shareActivity()) {
      <app-share-card [activity]="shareActivity()!" (close)="closeShareCard()" />
    }
  `,
})
export class StravaComponent implements OnInit {
  readonly strava = inject(StravaService);

  private readonly snackBar = inject(MatSnackBar);

  // Pagination state
  readonly currentPage = signal(0);
  readonly pageSize = signal(20);

  // Share card state
  readonly shareActivity = signal<StravaActivity | null>(null);
  readonly sharingId = signal<string | null>(null);

  ngOnInit() {
    this.strava.loadStatus().subscribe({ error: () => {} });
    this.loadPage();
  }

  loadPage() {
    this.strava.loadActivities({
      page: this.currentPage() + 1, // Backend uses 1-based indexing
      perPage: this.pageSize(),
    }).subscribe({
      error: () => {},
    });
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadPage();
  }

  syncActivities() {
    this.strava.sync().subscribe({
      next: (result) => {
        this.snackBar.open(
          `Sync complete: ${result.imported} new, ${result.updated} updated`,
          'Close',
          { duration: 4000 },
        );
        // Reset to first page and reload after sync
        this.currentPage.set(0);
        this.loadPage();
        // Refresh status to get new lastSyncedAt
        this.strava.loadStatus().subscribe();
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Sync failed. Please try again.';
        this.snackBar.open(`Sync failed: ${msg}`, 'Close', { duration: 10000 });
      },
    });
  }

  openShareCard(activity: StravaActivity): void {
    this.sharingId.set(activity.id);
    // Fetch the full activity (includes summaryPolyline from RawJson)
    this.strava.getActivity(activity.id).subscribe({
      next: (full) => {
        this.sharingId.set(null);
        this.shareActivity.set(full);
      },
      error: () => {
        this.sharingId.set(null);
        this.snackBar.open('Could not load activity details.', 'Close', { duration: 4000 });
      },
    });
  }

  closeShareCard(): void {
    this.shareActivity.set(null);
  }

  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  formatPace(distanceMeters: number, movingTimeSeconds: number): string {
    if (!distanceMeters || !movingTimeSeconds) return '—';

    const distanceKm = distanceMeters / 1000;
    const timeMinutes = movingTimeSeconds / 60;
    const paceMinPerKm = timeMinutes / distanceKm;

    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);

    return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
  }
}
