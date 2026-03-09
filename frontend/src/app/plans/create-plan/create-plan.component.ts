import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { PlansService } from '../../shared/services/plans.service';

@Component({
  selector: 'app-create-plan',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <div class="p-6 max-w-xl mx-auto">
      <a routerLink="/plans" class="text-sm text-gray-500 hover:underline flex items-center gap-1 w-fit mb-4">
        <mat-icon class="text-sm !w-4 !h-4">arrow_back</mat-icon>
        Back to plans
      </a>
      <h1 class="text-2xl font-bold mb-1">Create Training Plan</h1>
      <p class="text-gray-500 text-sm mb-6">
        We'll generate a personalised week-by-week plan using progressive overload,
        working up from your current base to race day.
      </p>

      <mat-card class="p-6">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">

          <mat-form-field appearance="outline">
            <mat-label>Plan name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Paris Marathon 2026" />
            <mat-error>Name must be at least 3 characters</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Goal event / race</mat-label>
            <input matInput formControlName="goalEvent" placeholder="e.g. Marathon, 10K, Half Marathon" />
            <mat-hint>The type of race you're training for</mat-hint>
            <mat-error>Goal event is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Goal date (race day)</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="goalDate" [min]="minDate" />
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            <mat-hint>The date of your target race</mat-hint>
            <mat-error>A future date is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Current weekly volume (km)</mat-label>
            <input matInput type="number" formControlName="currentWeeklyVolumeKm" min="0" max="300" />
            <span matSuffix>km</span>
            <mat-hint>How many km you currently run per week — this is your starting point</mat-hint>
            <mat-error>Enter a value between 0 and 300</mat-error>
          </mat-form-field>

          <div class="border-t pt-4 mt-2">
            <h3 class="text-sm font-semibold mb-3 text-gray-700">Weekly Schedule Preferences (Optional)</h3>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Runs per week</mat-label>
              <mat-select formControlName="runsPerWeek">
                <mat-option [value]="3">3 runs per week</mat-option>
                <mat-option [value]="4">4 runs per week</mat-option>
                <mat-option [value]="5">5 runs per week</mat-option>
              </mat-select>
              <mat-hint>How many times you want to run weekly</mat-hint>
            </mat-form-field>

            <div class="grid grid-cols-3 gap-3">
              <mat-form-field appearance="outline">
                <mat-label>Easy run day</mat-label>
                <mat-select formControlName="easyRunDay">
                  @for (day of daysOfWeek; track day.value) {
                    <mat-option [value]="day.value">{{ day.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Long run day</mat-label>
                <mat-select formControlName="longRunDay">
                  @for (day of daysOfWeek; track day.value) {
                    <mat-option [value]="day.value">{{ day.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Interval/tempo day</mat-label>
                <mat-select formControlName="intervalRunDay">
                  @for (day of daysOfWeek; track day.value) {
                    <mat-option [value]="day.value">{{ day.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          @if (weeksUntilRace() > 0) {
            <div class="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 flex items-start gap-2">
              <mat-icon class="text-blue-500 flex-shrink-0 !w-4 !h-4 mt-0.5 text-base">info</mat-icon>
              <span>
                Your plan will have <strong>{{ weeksUntilRace() }} weeks</strong>,
                including taper weeks before race day.
              </span>
            </div>
          }

          @if (error()) {
            <p class="text-red-600 text-sm">{{ error() }}</p>
          }

          <div class="flex gap-3 mt-1">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="loading() || form.invalid"
            >
              @if (loading()) {
                <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
                Generating...
              } @else {
                <mat-icon>auto_awesome</mat-icon>
                Generate Plan
              }
            </button>
            <button mat-stroked-button type="button" routerLink="/plans" [disabled]="loading()">
              Cancel
            </button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
})
export class CreatePlanComponent {
  private readonly plansService = inject(PlansService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  loading = signal(false);
  error = signal<string | null>(null);

  readonly minDate = new Date();

  readonly daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    goalEvent: ['', [Validators.required, Validators.minLength(2)]],
    goalDate: [null as Date | null, [Validators.required]],
    currentWeeklyVolumeKm: [
      30,
      [Validators.required, Validators.min(0), Validators.max(300)],
    ],
    runsPerWeek: [3],
    easyRunDay: [2], // Tuesday
    longRunDay: [0], // Sunday
    intervalRunDay: [4], // Thursday
  });

  weeksUntilRace(): number {
    const goalDate = this.form.get('goalDate')?.value;
    if (!goalDate) return 0;
    const diff = (goalDate as Date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
  }

  onSubmit() {
    if (this.form.invalid) {
      console.error('Form is invalid:', this.form.errors);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { name, goalEvent, goalDate, currentWeeklyVolumeKm, runsPerWeek, easyRunDay, longRunDay, intervalRunDay } = this.form.value;

    const goalDateStr = goalDate
      ? (goalDate as Date).toISOString().split('T')[0]
      : '';

    const payload = {
      name: name!,
      goalEvent: goalEvent!,
      goalDate: goalDateStr,
      currentWeeklyVolumeKm: currentWeeklyVolumeKm!,
      runsPerWeek: runsPerWeek ?? undefined,
      easyRunDay: easyRunDay ?? undefined,
      longRunDay: longRunDay ?? undefined,
      intervalRunDay: intervalRunDay ?? undefined,
    };

    console.log('Creating plan with payload:', payload);

    this.plansService
      .createPlan(payload)
      .subscribe({
        next: (plan) => {
          console.log('Plan created successfully:', plan);
          this.snackBar.open('Training plan created!', 'Close', { duration: 3000 });
          this.router.navigate(['/plans', plan.id]);
        },
        error: (err) => {
          console.error('Failed to create plan:', err);
          this.error.set(err.error?.message || 'Failed to create plan. Please try again.');
          this.loading.set(false);
        },
      });
  }
}
