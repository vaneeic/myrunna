import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
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
    MatTableModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
    ShareCardComponent,
  ],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Strava Activities</h1>
          @if (strava.status().lastSyncedAt) {
            <p class="text-sm text-gray-500 mt-1">
              Last synced: {{ strava.status().lastSyncedAt | date:'medium' }}
            </p>
          }
        </div>
        <button
          mat-raised-button
          color="primary"
          (click)="syncActivities()"
          [disabled]="strava.syncing()"
        >
          @if (strava.syncing()) {
            <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
            Syncing...
          } @else {
            <mat-icon>sync</mat-icon>
            Sync Activities
          }
        </button>
      </div>

      <!-- Not connected banner -->
      @if (strava.status().connected === false) {
        <mat-card class="p-6 text-center mb-6">
          <mat-icon class="text-orange-500 text-5xl mb-3" style="font-size:48px;width:48px;height:48px;">
            fitness_center
          </mat-icon>
          <p class="text-gray-700 font-medium mb-1">Strava not connected</p>
          <p class="text-gray-500 text-sm mb-4">
            Connect your Strava account to import your runs automatically.
          </p>
          <a mat-raised-button color="accent" routerLink="/settings"
            style="background-color: #FC4C02; color: white;">
            Connect Strava
          </a>
        </mat-card>
      }

      <!-- Activities table -->
      @if (strava.activities().length > 0) {
        <mat-card>
          <table mat-table [dataSource]="strava.activities()" class="w-full">

            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let a">
                {{ a.startDate | date:'mediumDate' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Activity</th>
              <td mat-cell *matCellDef="let a">
                <div class="font-medium">{{ a.name }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="distance">
              <th mat-header-cell *matHeaderCellDef>Distance</th>
              <td mat-cell *matCellDef="let a">
                {{ (a.distance / 1000) | number:'1.2-2' }} km
              </td>
            </ng-container>

            <ng-container matColumnDef="time">
              <th mat-header-cell *matHeaderCellDef>Time</th>
              <td mat-cell *matCellDef="let a">{{ formatTime(a.movingTime) }}</td>
            </ng-container>

            <ng-container matColumnDef="avgPace">
              <th mat-header-cell *matHeaderCellDef>Avg Pace</th>
              <td mat-cell *matCellDef="let a">
                {{ formatPace(a.distance, a.movingTime) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="heartrate">
              <th mat-header-cell *matHeaderCellDef>Avg HR</th>
              <td mat-cell *matCellDef="let a">
                @if (a.averageHeartrate) {
                  {{ a.averageHeartrate | number:'1.0-0' }} bpm
                } @else {
                  <span class="text-gray-400">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="suffer">
              <th mat-header-cell *matHeaderCellDef>Suffer Score</th>
              <td mat-cell *matCellDef="let a">
                @if (a.sufferScore) {
                  {{ a.sufferScore }}
                } @else {
                  <span class="text-gray-400">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="share">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let a">
                <button
                  mat-icon-button
                  matTooltip="Generate share card"
                  [disabled]="sharingId() === a.id"
                  (click)="openShareCard(a)"
                  style="color: #e91e8c;"
                >
                  @if (sharingId() === a.id) {
                    <mat-spinner diameter="18"></mat-spinner>
                  } @else {
                    <mat-icon>ios_share</mat-icon>
                  }
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
          </table>

          <!-- Pagination -->
          <mat-paginator
            [length]="strava.totalActivities()"
            [pageSize]="pageSize()"
            [pageIndex]="currentPage()"
            [pageSizeOptions]="[10, 20, 50, 100]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        </mat-card>
      } @else if (strava.status().connected) {
        <mat-card class="p-8 text-center">
          <mat-icon class="text-gray-400 mb-3" style="font-size:48px;width:48px;height:48px;">
            directions_run
          </mat-icon>
          <p class="text-gray-600 mb-4">No activities synced yet.</p>
          <button mat-raised-button color="primary" (click)="syncActivities()">
            <mat-icon>sync</mat-icon>
            Sync Now
          </button>
        </mat-card>
      }
    </div>

    <!-- Share card modal -->
    @if (shareActivity()) {
      <app-share-card
        [activity]="shareActivity()!"
        (close)="closeShareCard()"
      />
    }
  `,
})
export class StravaComponent implements OnInit {
  readonly strava = inject(StravaService);
  readonly displayedColumns = ['date', 'name', 'distance', 'time', 'avgPace', 'heartrate', 'suffer', 'share'];

  private readonly snackBar = inject(MatSnackBar);

  // Pagination state
  readonly currentPage = signal(0);
  readonly pageSize = signal(20);

  // Share card state
  readonly shareActivity = signal<StravaActivity | null>(null);
  readonly sharingId = signal<string | null>(null);

  ngOnInit() {
    this.strava.loadStatus().subscribe({
      next: (s) => {
        if (s.connected) {
          this.loadPage();
        }
      },
      error: () => {},
    });
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
