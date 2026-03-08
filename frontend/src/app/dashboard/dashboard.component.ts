import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../shared/services/auth.service';
import { StravaService } from '../shared/services/strava.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">
          Welcome back, {{ authService.user()?.displayName ?? 'Runner' }}
        </h1>
        <p class="text-gray-500 mt-1">Here's your training overview.</p>
      </div>

      <!-- Quick action cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <mat-card
          class="p-4 cursor-pointer hover:shadow-md transition-shadow"
          routerLink="/plans"
        >
          <div class="flex items-center gap-3">
            <mat-icon class="text-3xl" style="color: #1a73e8">directions_run</mat-icon>
            <div>
              <h3 class="font-semibold">My Plans</h3>
              <p class="text-sm text-gray-500">View training plans</p>
            </div>
          </div>
        </mat-card>

        <mat-card
          class="p-4 cursor-pointer hover:shadow-md transition-shadow"
          routerLink="/strava"
        >
          <div class="flex items-center gap-3">
            <mat-icon class="text-3xl" style="color: #FC4C02">fitness_center</mat-icon>
            <div>
              <h3 class="font-semibold">Strava Activities</h3>
              <p class="text-sm text-gray-500">
                @if (strava.status().connected) {
                  Recent runs
                } @else {
                  Not connected
                }
              </p>
            </div>
          </div>
        </mat-card>

        <mat-card
          class="p-4 cursor-pointer hover:shadow-md transition-shadow"
          routerLink="/settings"
        >
          <div class="flex items-center gap-3">
            <mat-icon class="text-3xl text-gray-600">settings</mat-icon>
            <div>
              <h3 class="font-semibold">Settings</h3>
              <p class="text-sm text-gray-500">Profile & integrations</p>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Strava connect prompt (shown only when not connected) -->
      @if (!strava.status().connected) {
        <mat-card class="p-6 mb-6 border-l-4" style="border-left-color: #FC4C02">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold mb-1 flex items-center gap-2">
                <mat-icon style="color:#FC4C02">fitness_center</mat-icon>
                Connect Strava
              </h2>
              <p class="text-gray-600 text-sm">
                Link your Strava account to automatically import your runs and
                track your progress against your training plan.
              </p>
            </div>
            <button
              mat-raised-button
              routerLink="/settings"
              style="background-color: #FC4C02; color: white; white-space: nowrap;"
            >
              Connect
            </button>
          </div>
        </mat-card>
      }

      <!-- Recent activities (shown when connected and activities exist) -->
      @if (strava.status().connected && strava.activities().length > 0) {
        <mat-card class="p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Recent Runs</h2>
            <a mat-button routerLink="/strava">View all</a>
          </div>
          <div class="divide-y">
            @for (act of strava.activities().slice(0, 5); track act.id) {
              <div class="py-3 flex items-center justify-between gap-4">
                <div>
                  <p class="font-medium text-sm">{{ act.name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ act.startDate | date:'mediumDate' }}
                  </p>
                </div>
                <div class="text-right text-sm">
                  <p class="font-medium">
                    {{ (act.distance / 1000) | number:'1.2-2' }} km
                  </p>
                  <p class="text-gray-500">{{ formatTime(act.movingTime) }}</p>
                </div>
              </div>
            }
          </div>
        </mat-card>
      }

      <!-- Getting started card -->
      <mat-card class="p-6">
        <h2 class="text-lg font-semibold mb-2">Getting Started</h2>
        <p class="text-gray-600 mb-4">
          Create your first training plan to get started, or connect your Strava
          account to import your recent activities.
        </p>
        <div class="flex gap-3 flex-wrap">
          <button mat-raised-button color="primary" routerLink="/plans">
            <mat-icon>add</mat-icon>
            Create Training Plan
          </button>
          @if (!strava.status().connected) {
            <button mat-stroked-button routerLink="/settings">
              Connect Strava
            </button>
          }
        </div>
      </mat-card>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly strava = inject(StravaService);

  ngOnInit() {
    this.strava.loadStatus().subscribe({
      next: (s) => {
        if (s.connected) {
          // Pre-load the 5 most recent activities for the dashboard preview
          this.strava.loadActivities({ page: 1, perPage: 5 }).subscribe();
        }
      },
      error: () => {},
    });
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
}
