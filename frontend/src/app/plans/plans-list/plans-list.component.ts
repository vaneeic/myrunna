import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../shared/services/api.service';

interface TrainingPlan {
  id: string;
  name: string;
  goalEvent: string;
  goalDate: string;
  isActive: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Training Plans</h1>
        <button mat-raised-button color="primary" routerLink="/plans/new">
          <mat-icon>add</mat-icon>
          New Plan
        </button>
      </div>

      @if (loading()) {
        <p class="text-gray-500">Loading plans...</p>
      } @else if (plans().length === 0) {
        <mat-card class="p-8 text-center">
          <mat-icon class="text-5xl text-gray-300 mb-4 block">directions_run</mat-icon>
          <h3 class="text-lg font-medium mb-2">No training plans yet</h3>
          <p class="text-gray-500 mb-4">Create your first plan to get started.</p>
          <button mat-raised-button color="primary" routerLink="/plans/new">
            Create your first plan
          </button>
        </mat-card>
      } @else {
        <div class="grid gap-4">
          @for (plan of plans(); track plan.id) {
            <mat-card
              class="p-4 cursor-pointer hover:shadow-md transition-shadow"
              [routerLink]="['/plans', plan.id]"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-lg">{{ plan.name }}</h3>
                    @if (plan.isActive) {
                      <mat-chip class="text-xs bg-green-100 text-green-700">Active</mat-chip>
                    }
                  </div>
                  <p class="text-gray-600">{{ plan.goalEvent }}</p>
                  <p class="text-sm text-gray-400 mt-1">
                    Goal date: {{ plan.goalDate | date:'mediumDate' }}
                  </p>
                </div>
                <mat-icon class="text-gray-400">chevron_right</mat-icon>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
})
export class PlansListComponent implements OnInit {
  plans = signal<TrainingPlan[]>([]);
  loading = signal(true);

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<TrainingPlan[]>('/training-plans').subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
