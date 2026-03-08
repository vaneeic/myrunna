import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">Settings</h1>

      <!-- Profile -->
      <mat-card class="p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Profile</h2>
        <p class="text-gray-600">
          <strong>Name:</strong> {{ authService.user()?.displayName }}
        </p>
        <p class="text-gray-600 mt-2">
          <strong>Email:</strong> {{ authService.user()?.email }}
        </p>
      </mat-card>

      <mat-divider class="mb-6"></mat-divider>

      <!-- Strava -->
      <mat-card class="p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <mat-icon class="text-orange-500">fitness_center</mat-icon>
          Strava Integration
        </h2>

        @if (stravaStatus()?.connected) {
          <div class="flex items-center justify-between">
            <div>
              <p class="text-green-600 font-medium">Connected</p>
              <p class="text-sm text-gray-500">Athlete ID: {{ stravaStatus()?.athleteId }}</p>
            </div>
            <button mat-stroked-button color="warn" (click)="disconnectStrava()">
              Disconnect
            </button>
          </div>
        } @else {
          <p class="text-gray-600 mb-4">
            Connect your Strava account to automatically sync your runs.
          </p>
          <button mat-raised-button color="accent" (click)="connectStrava()"
            style="background-color: #FC4C02; color: white;">
            <mat-icon>link</mat-icon>
            Connect Strava
          </button>
        }
      </mat-card>

      <mat-divider class="mb-6"></mat-divider>

      <!-- Logout -->
      <button mat-stroked-button color="warn" (click)="authService.logout()">
        <mat-icon>logout</mat-icon>
        Sign out
      </button>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  stravaStatus = signal<any>(null);

  constructor(
    readonly authService: AuthService,
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    // Show feedback from Strava OAuth redirect
    this.route.queryParams.subscribe((params) => {
      if (params['strava'] === 'connected') {
        this.snackBar.open('Strava connected successfully!', 'Close', { duration: 4000 });
      } else if (params['strava'] === 'denied') {
        this.snackBar.open('Strava connection was cancelled.', 'Close', { duration: 4000 });
      } else if (params['strava'] === 'error') {
        this.snackBar.open('Failed to connect Strava. Please try again.', 'Close', { duration: 4000 });
      }
    });

    this.loadStravaStatus();
  }

  private loadStravaStatus() {
    this.api.get<any>('/strava/status').subscribe({
      next: (s) => this.stravaStatus.set(s),
      error: () => {},
    });
  }

  connectStrava() {
    this.api.get<{ url: string }>('/strava/connect').subscribe({
      next: ({ url }) => (window.location.href = url),
      error: () =>
        this.snackBar.open('Failed to get Strava authorization URL.', 'Close', { duration: 4000 }),
    });
  }

  disconnectStrava() {
    this.api.delete<void>('/strava/disconnect').subscribe({
      next: () => {
        this.stravaStatus.set({ connected: false });
        this.snackBar.open('Strava disconnected.', 'Close', { duration: 3000 });
      },
      error: () =>
        this.snackBar.open('Failed to disconnect Strava.', 'Close', { duration: 4000 }),
    });
  }
}
