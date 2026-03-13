import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule,
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

          <!-- Manual sync buttons with menu -->
          <div class="flex gap-2">
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
                Sync Last Year (365 days)
              }
            </button>
            
            <button
              mat-icon-button
              [matMenuTriggerFor]="syncMenu"
              [disabled]="strava.syncing()"
              matTooltip="More sync options"
            >
              <mat-icon>more_vert</mat-icon>
            </button>
            
            <mat-menu #syncMenu="matMenu">
              <button mat-menu-item (click)="syncNow(30)">
                <mat-icon>today</mat-icon>
                <span>Last 30 days</span>
              </button>
              <button mat-menu-item (click)="syncNow(90)">
                <mat-icon>date_range</mat-icon>
                <span>Last 90 days</span>
              </button>
              <button mat-menu-item (click)="syncNow(365)">
                <mat-icon>calendar_month</mat-icon>
                <span>Last 365 days (Full year)</span>
              </button>
              <button mat-menu-item (click)="syncNow(730)">
                <mat-icon>event_repeat</mat-icon>
                <span>Last 2 years</span>
              </button>
            </mat-menu>
          </div>
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
          Format: MM:SS per km (e.g., 5:30/km)
        </p>

        <form [formGroup]="paceForm" (ngSubmit)="savePaces()" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>5K Pace (min/km)</mat-label>
              <input matInput type="text" formControlName="pace5k" placeholder="4:30" pattern="[0-9]+:[0-5][0-9]">
              <mat-hint>e.g., 4:30/km</mat-hint>
              @if (paceForm.get('pace5k')?.hasError('pattern') && paceForm.get('pace5k')?.touched) {
                <mat-error>Use MM:SS format (e.g., 4:30)</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>10K Pace (min/km)</mat-label>
              <input matInput type="text" formControlName="pace10k" placeholder="5:00" pattern="[0-9]+:[0-5][0-9]">
              <mat-hint>e.g., 5:00/km</mat-hint>
              @if (paceForm.get('pace10k')?.hasError('pattern') && paceForm.get('pace10k')?.touched) {
                <mat-error>Use MM:SS format (e.g., 5:00)</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>15K Pace (min/km)</mat-label>
              <input matInput type="text" formControlName="pace15k" placeholder="5:15" pattern="[0-9]+:[0-5][0-9]">
              <mat-hint>e.g., 5:15/km</mat-hint>
              @if (paceForm.get('pace15k')?.hasError('pattern') && paceForm.get('pace15k')?.touched) {
                <mat-error>Use MM:SS format (e.g., 5:15)</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Half Marathon Pace (min/km)</mat-label>
              <input matInput type="text" formControlName="paceHM" placeholder="5:30" pattern="[0-9]+:[0-5][0-9]">
              <mat-hint>e.g., 5:30/km</mat-hint>
              @if (paceForm.get('paceHM')?.hasError('pattern') && paceForm.get('paceHM')?.touched) {
                <mat-error>Use MM:SS format (e.g., 5:30)</mat-error>
              }
            </mat-form-field>
          </div>

          <div class="flex gap-2">
            <button mat-raised-button color="primary" type="submit" [disabled]="savingPaces() || paceForm.invalid">
              @if (savingPaces()) {
                <mat-spinner diameter="16" class="inline-block mr-2"></mat-spinner>
                Saving...
              } @else {
                <mat-icon>save</mat-icon>
                Save Paces
              }
            </button>
            <button mat-stroked-button type="button" (click)="recalculatePaces()" [disabled]="savingPaces()">
              <mat-icon>refresh</mat-icon>
              Recalculate from Strava
            </button>
            <button mat-stroked-button type="button" (click)="resetForm()" [disabled]="savingPaces()">
              <mat-icon>undo</mat-icon>
              Reset Form
            </button>
          </div>
        </form>
        
        <p class="text-sm text-gray-500 mt-4">
          <mat-icon class="text-sm align-middle mr-1" style="font-size:16px;width:16px;height:16px;">info</mat-icon>
          <strong>Note:</strong> Paces are automatically calculated from your Strava activities during sync. 
          Click "Recalculate from Strava" to update paces based on your latest runs, or manually adjust them above.
        </p>
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
      pace5k: [null, Validators.pattern(/^[0-9]+:[0-5][0-9]$/)],
      pace10k: [null, Validators.pattern(/^[0-9]+:[0-5][0-9]$/)],
      pace15k: [null, Validators.pattern(/^[0-9]+:[0-5][0-9]$/)],
      paceHM: [null, Validators.pattern(/^[0-9]+:[0-5][0-9]$/)],
    });
  }

  /**
   * Convert decimal pace (e.g., 5.5) to MM:SS format (e.g., "5:30")
   */
  private decimalToTime(decimal: number | null | undefined): string {
    if (decimal === null || decimal === undefined) return '';
    const minutes = Math.floor(decimal);
    const seconds = Math.round((decimal - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Convert MM:SS format (e.g., "5:30") to decimal pace (e.g., 5.5)
   */
  private timeToDecimal(time: string | null): number | undefined {
    if (!time) return undefined;
    const match = time.match(/^(\d+):([0-5]\d)$/);
    if (!match) return undefined;
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    return minutes + seconds / 60;
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
          pace5k: this.decimalToTime(user.pace5kMinPerKm),
          pace10k: this.decimalToTime(user.pace10kMinPerKm),
          pace15k: this.decimalToTime(user.pace15kMinPerKm),
          paceHM: this.decimalToTime(user.paceHalfMarathonMinPerKm),
        });
      },
      error: () => {
        this.snackBar.open('Failed to load pace settings.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  resetForm() {
    this.loadPaces();
    this.snackBar.open('Form reset to saved values.', 'Close', {
      duration: 2000,
    });
  }

  recalculatePaces() {
    this.savingPaces.set(true);
    this.strava.recalculatePaces().subscribe({
      next: (updatedPaces) => {
        this.savingPaces.set(false);
        // Reload the fresh values into the form
        this.loadPaces();
        this.snackBar.open(
          'Paces recalculated from your Strava activities!',
          'Close',
          { duration: 4000 },
        );
      },
      error: () => {
        this.savingPaces.set(false);
        this.snackBar.open(
          'Failed to recalculate paces. Make sure you have Strava activities synced.',
          'Close',
          { duration: 5000 },
        );
      },
    });
  }

  savePaces() {
    if (this.paceForm.invalid) {
      this.snackBar.open('Please enter valid pace values in MM:SS format.', 'Close', {
        duration: 4000,
      });
      return;
    }

    this.savingPaces.set(true);
    const formValue = this.paceForm.value;
    
    this.usersService.updatePaces({
      pace5kMinPerKm: this.timeToDecimal(formValue.pace5k),
      pace10kMinPerKm: this.timeToDecimal(formValue.pace10k),
      pace15kMinPerKm: this.timeToDecimal(formValue.pace15k),
      paceHalfMarathonMinPerKm: this.timeToDecimal(formValue.paceHM),
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

  syncNow(daysBack?: number) {
    const syncOptions = daysBack ? { daysBack } : undefined;
    const daysLabel = daysBack 
      ? `last ${daysBack} days` 
      : 'last year (365 days)';
    
    this.strava.sync(syncOptions).subscribe({
      next: (result) => {
        this.snackBar.open(
          `Sync complete (${daysLabel}): ${result.imported} new, ${result.updated} updated`,
          'Close',
          { duration: 5000 },
        );
        // Refresh status to show the updated lastSyncedAt
        this.strava.loadStatus().subscribe({ error: () => {} });
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Sync failed. Please try again.';
        this.snackBar.open(`Sync failed: ${msg}`, 'Close', { duration: 10000 });
      },
    });
  }
}
