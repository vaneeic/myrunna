import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../shared/services/auth.service';
import { StravaService } from '../shared/services/strava.service';
import { GoogleCalendarService } from '../shared/services/google-calendar.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
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

      <!-- Strava Integration -->
      <mat-card class="p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <!-- Strava brand orange -->
          <mat-icon style="color:#FC4C02">fitness_center</mat-icon>
          Strava Integration
        </h2>

        @if (strava.status().connected) {
          <!-- Connected state -->
          <div class="rounded-lg bg-green-50 border border-green-200 p-4 mb-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <mat-icon class="text-green-600" style="font-size:18px;width:18px;height:18px;">
                    check_circle
                  </mat-icon>
                  <span class="text-green-700 font-semibold">Connected</span>
                </div>
                @if (strava.status().athleteName) {
                  <p class="text-gray-700 font-medium">
                    {{ strava.status().athleteName }}
                  </p>
                }
                <p class="text-sm text-gray-500">
                  Athlete ID: {{ strava.status().athleteId }}
                </p>
                @if (strava.status().lastSyncedAt) {
                  <p class="text-sm text-gray-500 mt-1">
                    Last synced: {{ strava.status().lastSyncedAt | date:'medium' }}
                  </p>
                } @else {
                  <p class="text-sm text-gray-400 mt-1">Never synced</p>
                }
              </div>
              <button mat-stroked-button color="warn" (click)="disconnectStrava()">
                <mat-icon>link_off</mat-icon>
                Disconnect
              </button>
            </div>
          </div>

          <!-- Manual sync button -->
          <button
            mat-stroked-button
            (click)="syncNow()"
            [disabled]="strava.syncing()"
          >
            @if (strava.syncing()) {
              <mat-spinner diameter="16" class="inline-block mr-2"></mat-spinner>
              Syncing...
            } @else {
              <mat-icon>sync</mat-icon>
              Sync Now
            }
          </button>
        } @else {
          <!-- Disconnected state -->
          <p class="text-gray-600 mb-4">
            Connect your Strava account to automatically import your runs into
            MyRunna. We request <code class="text-sm bg-gray-100 px-1 rounded">activity:read_all</code>
            and <code class="text-sm bg-gray-100 px-1 rounded">profile:read_all</code> scopes.
          </p>
          <button
            mat-raised-button
            (click)="connectStrava()"
            style="background-color: #FC4C02; color: white;"
          >
            <mat-icon>link</mat-icon>
            Connect Strava
          </button>
        }
      </mat-card>

      <mat-divider class="mb-6"></mat-divider>

      <!-- Pace Settings -->
      <mat-card class="p-6 mb-6">
        <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
          <mat-icon>speed</mat-icon>
          Training Paces
        </h2>
        <p class="text-sm text-gray-600 mb-4">
          Set your target paces for different distances. These are automatically calculated from your Strava activities but can be manually adjusted.
          Format: decimal minutes per km (e.g., 5:30/km = 5.5)
        </p>

        <form [formGroup]="paceForm" (ngSubmit)="savePaces()" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>5K Pace (min/km)</mat-label>
              <input matInput type="number" step="0.05" formControlName="pace5k" placeholder="4.5">
              <mat-hint>e.g., 4:30/km = 4.5</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>10K Pace (min/km)</mat-label>
              <input matInput type="number" step="0.05" formControlName="pace10k" placeholder="5.0">
              <mat-hint>e.g., 5:00/km = 5.0</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>15K Pace (min/km)</mat-label>
              <input matInput type="number" step="0.05" formControlName="pace15k" placeholder="5.25">
              <mat-hint>e.g., 5:15/km = 5.25</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Half Marathon Pace (min/km)</mat-label>
              <input matInput type="number" step="0.05" formControlName="paceHM" placeholder="5.5">
              <mat-hint>e.g., 5:30/km = 5.5</mat-hint>
            </mat-form-field>
          </div>

          <div class="flex gap-2">
            <button mat-raised-button color="primary" type="submit" [disabled]="savingPaces()">
              @if (savingPaces()) {
                <mat-spinner diameter="16" class="inline-block mr-2"></mat-spinner>
                Saving...
              } @else {
                <mat-icon>save</mat-icon>
                Save Paces
              }
            </button>
            <button mat-stroked-button type="button" (click)="loadPaces()" [disabled]="savingPaces()">
              <mat-icon>refresh</mat-icon>
              Reset
            </button>
          </div>
        </form>
      </mat-card>

      <mat-divider class="mb-6"></mat-divider>

      <!-- Sign out -->
      <button mat-stroked-button color="warn" (click)="authService.logout()">
        <mat-icon>logout</mat-icon>
        Sign out
      </button>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly strava = inject(StravaService);
  readonly usersService = inject(UsersService);

  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  paceForm: FormGroup;
  savingPaces = signal(false);

  constructor() {
    this.paceForm = this.fb.group({
      pace5k: [null],
      pace10k: [null],
      pace15k: [null],
      paceHM: [null],
    });
  }

  ngOnInit() {
    // Show feedback from Strava OAuth redirect params
    this.route.queryParams.subscribe((params) => {
      if (params['strava'] === 'connected') {
        this.snackBar.open('Strava connected successfully!', 'Close', {
          duration: 4000,
        });
      } else if (params['strava'] === 'denied') {
        this.snackBar.open('Strava connection was cancelled.', 'Close', {
          duration: 4000,
        });
      } else if (params['strava'] === 'error') {
        this.snackBar.open(
          'Failed to connect Strava. Please try again.',
          'Close',
          { duration: 4000 },
        );
      }
    });

    this.strava.loadStatus().subscribe({ error: () => {} });
    this.loadPaces();
  }

  loadPaces() {
    this.usersService.getMe().subscribe({
      next: (user) => {
        this.paceForm.patchValue({
          pace5k: user.pace5kMinPerKm,
          pace10k: user.pace10kMinPerKm,
          pace15k: user.pace15kMinPerKm,
          paceHM: user.paceHalfMarathonMinPerKm,
        });
      },
      error: () => {
        this.snackBar.open('Failed to load pace settings.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  savePaces() {
    this.savingPaces.set(true);
    const formValue = this.paceForm.value;
    
    this.usersService.updatePaces({
      pace5kMinPerKm: formValue.pace5k,
      pace10kMinPerKm: formValue.pace10k,
      pace15kMinPerKm: formValue.pace15k,
      paceHalfMarathonMinPerKm: formValue.paceHM,
    }).subscribe({
      next: () => {
        this.savingPaces.set(false);
        this.snackBar.open('Pace settings saved successfully!', 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.savingPaces.set(false);
        this.snackBar.open('Failed to save pace settings.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  connectStrava() {
    this.strava.connect().subscribe({
      next: ({ url }) => (window.location.href = url),
      error: () =>
        this.snackBar.open(
          'Failed to get Strava authorization URL.',
          'Close',
          { duration: 4000 },
        ),
    });
  }

  disconnectStrava() {
    this.strava.disconnect().subscribe({
      next: () =>
        this.snackBar.open('Strava disconnected.', 'Close', { duration: 3000 }),
      error: () =>
        this.snackBar.open('Failed to disconnect Strava.', 'Close', {
          duration: 4000,
        }),
    });
  }

  syncNow() {
    this.strava.sync().subscribe({
      next: (result) => {
        this.snackBar.open(
          `Sync complete: ${result.imported} new, ${result.updated} updated`,
          'Close',
          { duration: 4000 },
        );
        // Refresh status to show the updated lastSyncedAt
        this.strava.loadStatus().subscribe({ error: () => {} });
      },
      error: () =>
        this.snackBar.open('Sync failed. Please try again.', 'Close', {
          duration: 4000,
        }),
    });
  }
}
