import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">
          Welcome back, {{ authService.user()?.displayName ?? 'Runner' }}
        </h1>
        <p class="text-gray-500 mt-1">Here's your training overview.</p>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <mat-card class="p-4 cursor-pointer hover:shadow-md transition-shadow" routerLink="/plans">
          <div class="flex items-center gap-3">
            <mat-icon class="text-primary-600 text-3xl">directions_run</mat-icon>
            <div>
              <h3 class="font-semibold">My Plans</h3>
              <p class="text-sm text-gray-500">View training plans</p>
            </div>
          </div>
        </mat-card>

        <mat-card class="p-4 cursor-pointer hover:shadow-md transition-shadow" routerLink="/strava">
          <div class="flex items-center gap-3">
            <mat-icon class="text-orange-500 text-3xl">fitness_center</mat-icon>
            <div>
              <h3 class="font-semibold">Strava Activities</h3>
              <p class="text-sm text-gray-500">Recent runs</p>
            </div>
          </div>
        </mat-card>

        <mat-card class="p-4 cursor-pointer hover:shadow-md transition-shadow" routerLink="/settings">
          <div class="flex items-center gap-3">
            <mat-icon class="text-gray-600 text-3xl">settings</mat-icon>
            <div>
              <h3 class="font-semibold">Settings</h3>
              <p class="text-sm text-gray-500">Profile & integrations</p>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Placeholder content -->
      <mat-card class="p-6">
        <h2 class="text-lg font-semibold mb-2">Getting Started</h2>
        <p class="text-gray-600 mb-4">
          Create your first training plan to get started, or connect your Strava account to import your recent activities.
        </p>
        <div class="flex gap-3">
          <button mat-raised-button color="primary" routerLink="/plans">
            <mat-icon>add</mat-icon>
            Create Training Plan
          </button>
          <button mat-stroked-button routerLink="/settings">
            Connect Strava
          </button>
        </div>
      </mat-card>
    </div>
  `,
})
export class DashboardComponent {
  constructor(readonly authService: AuthService) {}
}
