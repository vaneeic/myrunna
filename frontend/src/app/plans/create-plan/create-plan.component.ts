import { Component, signal } from '@angular/core';
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
import { ApiService } from '../../shared/services/api.service';

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
  ],
  template: `
    <div class="p-6 max-w-xl mx-auto">
      <a routerLink="/plans" class="text-primary-600 hover:underline text-sm">← Back to plans</a>
      <h1 class="text-2xl font-bold mt-2 mb-6">Create Training Plan</h1>

      <mat-card class="p-6">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">

          <mat-form-field appearance="outline">
            <mat-label>Plan name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Paris Marathon 2026" />
            <mat-error>Name must be at least 3 characters</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Goal event / race</mat-label>
            <input matInput formControlName="goalEvent" placeholder="e.g. Marathon, 10K, Half Marathon" />
            <mat-error>Goal event is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Goal date</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="goalDate" />
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            <mat-hint>The date of your target race</mat-hint>
            <mat-error>A future date is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Current weekly volume (km)</mat-label>
            <input matInput type="number" formControlName="currentWeeklyVolumeKm" min="0" max="300" />
            <span matSuffix>km</span>
            <mat-hint>How many km you currently run per week</mat-hint>
            <mat-error>Enter a value between 0 and 300</mat-error>
          </mat-form-field>

          @if (error()) {
            <p class="text-red-600 text-sm">{{ error() }}</p>
          }

          <div class="flex gap-3 mt-2">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="loading() || form.invalid"
            >
              @if (loading()) {
                <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
              }
              Generate Plan
            </button>
            <button mat-stroked-button type="button" routerLink="/plans">Cancel</button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
})
export class CreatePlanComponent {
  loading = signal(false);
  error = signal<string | null>(null);

  readonly minDate = new Date();

  form!: ReturnType<FormBuilder['group']>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      goalEvent: ['', [Validators.required, Validators.minLength(2)]],
      goalDate: [null as Date | null, [Validators.required]],
      currentWeeklyVolumeKm: [0, [Validators.required, Validators.min(0), Validators.max(300)]],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const { name, goalEvent, goalDate, currentWeeklyVolumeKm } = this.form.value;

    // Format date as ISO date string (YYYY-MM-DD)
    const goalDateStr = goalDate
      ? (goalDate as Date).toISOString().split('T')[0]
      : '';

    this.api
      .post<{ id: string }>('/training-plans', {
        name,
        goalEvent,
        goalDate: goalDateStr,
        currentWeeklyVolumeKm,
      })
      .subscribe({
        next: (plan) => {
          this.snackBar.open('Training plan created!', 'Close', { duration: 3000 });
          this.router.navigate(['/plans', plan.id]);
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to create plan. Please try again.');
          this.loading.set(false);
        },
      });
  }
}
