import { Component, signal, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatChipsModule,
  ],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      @if (loading()) {
        <p class="text-gray-500">Loading plan...</p>
      } @else if (plan()) {
        <div class="mb-6">
          <a routerLink="/plans" class="text-primary-600 hover:underline text-sm">← Back to plans</a>
          <h1 class="text-2xl font-bold mt-2">{{ plan()!.name }}</h1>
          <p class="text-gray-600">{{ plan()!.goalEvent }} · {{ plan()!.goalDate | date:'mediumDate' }}</p>
        </div>

        <div class="grid gap-3">
          @for (week of plan()!.weeks; track week.id) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <span class="font-medium">Week {{ week.weekNumber }}</span>
                  @if (week.isTaperWeek) {
                    <mat-chip class="ml-3 text-xs bg-blue-100 text-blue-700">Taper</mat-chip>
                  } @else if (week.isCutbackWeek) {
                    <mat-chip class="ml-3 text-xs bg-yellow-100 text-yellow-700">Recovery</mat-chip>
                  }
                </mat-panel-title>
                <mat-panel-description>
                  {{ week.startDate | date:'MMM d' }} · {{ week.weeklyVolumeKm }}km planned
                </mat-panel-description>
              </mat-expansion-panel-header>

              <p class="text-sm text-gray-600 mb-3 italic">{{ week.focus }}</p>
              <!-- Sessions will be populated in Phase 3 -->
              <p class="text-sm text-gray-400">Sessions loading in Phase 3...</p>
            </mat-expansion-panel>
          }
        </div>
      }
    </div>
  `,
})
export class PlanDetailComponent implements OnInit {
  @Input() id!: string;

  plan = signal<any | null>(null);
  loading = signal(true);

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<any>(`/training-plans/${this.id}`).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
