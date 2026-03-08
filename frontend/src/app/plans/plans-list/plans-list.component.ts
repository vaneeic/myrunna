import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlansService, TrainingPlan } from '../../shared/services/plans.service';

@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Training Plans</h1>
          <p class="text-gray-500 text-sm mt-0.5">Manage your running plans and track your goals.</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/plans/new">
          <mat-icon>add</mat-icon>
          New Plan
        </button>
      </div>

      @if (plansService.loading()) {
        <div class="flex items-center justify-center py-16">
          <mat-spinner diameter="36"></mat-spinner>
        </div>
      } @else if (plansService.plans().length === 0) {
        <mat-card class="p-10 text-center">
          <mat-icon class="text-6xl text-gray-200 mb-4 block" style="font-size: 64px; width: 64px; height: 64px;">directions_run</mat-icon>
          <h3 class="text-lg font-medium mb-1">No training plans yet</h3>
          <p class="text-gray-500 text-sm mb-5">Create your first plan to get started on your goal.</p>
          <button mat-raised-button color="primary" routerLink="/plans/new">
            <mat-icon>add</mat-icon>
            Create your first plan
          </button>
        </mat-card>
      } @else {
        <div class="grid gap-4">
          @for (plan of plansService.plans(); track plan.id) {
            <mat-card
              class="p-0 overflow-hidden hover:shadow-md transition-shadow"
              [class.ring-2]="plan.isActive"
              [class.ring-green-400]="plan.isActive"
            >
              <div class="flex items-stretch">
                <!-- Active indicator stripe -->
                <div
                  class="w-1 flex-shrink-0"
                  [class.bg-green-400]="plan.isActive"
                  [class.bg-gray-200]="!plan.isActive"
                ></div>

                <!-- Plan content (clickable) -->
                <a
                  [routerLink]="['/plans', plan.id]"
                  class="flex-1 p-4 flex items-start justify-between gap-4 no-underline text-inherit"
                >
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 class="font-semibold text-gray-900 truncate">{{ plan.name }}</h3>
                      @if (plan.isActive) {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">
                          <mat-icon class="!w-3 !h-3 text-xs">check_circle</mat-icon>
                          Active
                        </span>
                      }
                    </div>
                    <p class="text-gray-600 text-sm">{{ plan.goalEvent }}</p>
                    <p class="text-gray-400 text-xs mt-1">
                      Goal: {{ plan.goalDate | date:'mediumDate' }}
                      &nbsp;&middot;&nbsp;
                      Started {{ plan.currentWeeklyVolumeKm | number:'1.0-1' }} km/wk base
                    </p>
                  </div>
                  <mat-icon class="text-gray-300 flex-shrink-0 mt-1">chevron_right</mat-icon>
                </a>

                <!-- Actions menu -->
                <div class="flex items-center px-2">
                  <button
                    mat-icon-button
                    [matMenuTriggerFor]="planMenu"
                    (click)="$event.stopPropagation()"
                    class="text-gray-400"
                    matTooltip="Plan options"
                  >
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #planMenu="matMenu">
                    @if (!plan.isActive) {
                      <button mat-menu-item (click)="activate(plan)">
                        <mat-icon>check_circle</mat-icon>
                        Set as active
                      </button>
                    }
                    <button mat-menu-item [routerLink]="['/plans', plan.id]">
                      <mat-icon>visibility</mat-icon>
                      View plan
                    </button>
                    <button mat-menu-item class="text-red-600" (click)="confirmDelete(plan)">
                      <mat-icon class="text-red-600">delete</mat-icon>
                      Delete plan
                    </button>
                  </mat-menu>
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
})
export class PlansListComponent implements OnInit {
  readonly plansService = inject(PlansService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit() {
    this.plansService.loadPlans().subscribe();
  }

  activate(plan: TrainingPlan) {
    this.plansService.activatePlan(plan.id).subscribe({
      next: () => {
        this.snackBar.open(`"${plan.name}" is now your active plan.`, 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.snackBar.open('Failed to activate plan. Please try again.', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  confirmDelete(plan: TrainingPlan) {
    const confirmed = window.confirm(
      `Delete "${plan.name}"? This will remove all weeks and sessions. This cannot be undone.`,
    );
    if (!confirmed) return;

    this.plansService.deletePlan(plan.id).subscribe({
      next: () => {
        this.snackBar.open('Plan deleted.', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete plan. Please try again.', 'Close', {
          duration: 3000,
        });
      },
    });
  }
}
