import {
  Component,
  signal,
  computed,
  OnInit,
  Input,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  PlansService,
  TrainingPlanDetail,
  TrainingSession,
  TrainingWeek,
  SESSION_TYPE_CONFIG,
} from '../../shared/services/plans.service';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    DragDropModule,
  ],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (!plan()) {
        <mat-card class="p-8 text-center">
          <mat-icon class="text-5xl text-gray-300 mb-4 block">error_outline</mat-icon>
          <h3 class="text-lg font-medium mb-2">Plan not found</h3>
          <a mat-stroked-button routerLink="/plans">Back to plans</a>
        </mat-card>
      } @else {
        <!-- Header -->
        <div class="mb-6">
          <a routerLink="/plans" class="text-sm text-gray-500 hover:underline flex items-center gap-1 w-fit mb-3">
            <mat-icon class="text-sm !w-4 !h-4">arrow_back</mat-icon>
            Back to plans
          </a>
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-2xl font-bold">{{ plan()!.name }}</h1>
                @if (plan()!.isActive) {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <mat-icon class="!w-3 !h-3 text-xs">check_circle</mat-icon>
                    Active
                  </span>
                }
              </div>
              <p class="text-gray-600">
                {{ plan()!.goalEvent }}
                &middot;
                {{ plan()!.goalDate | date:'longDate' }}
              </p>
              <p class="text-sm text-gray-400 mt-1">
                {{ plan()!.weeks.length }} weeks
                &middot;
                Peak ~{{ peakVolumeKm() | number:'1.0-1' }} km/week
              </p>
            </div>
            <div class="flex items-center gap-2">
              <a
                mat-stroked-button
                [routerLink]="['/plans', plan()!.id, 'calendar']"
              >
                <mat-icon>calendar_month</mat-icon>
                Calendar view
              </a>
              @if (!plan()!.isActive) {
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="activate()"
                  [disabled]="activating()"
                >
                  Set as active
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Weeks -->
        <div class="flex flex-col gap-3">
          @for (week of plan()!.weeks; track week.id) {
            <mat-expansion-panel
              [expanded]="isCurrentWeek(week)"
              class="rounded-lg overflow-hidden"
              [class.border-l-4]="week.isTaperWeek || week.isCutbackWeek"
              [class.border-blue-400]="week.isTaperWeek"
              [class.border-yellow-400]="week.isCutbackWeek && !week.isTaperWeek"
            >
              <mat-expansion-panel-header class="py-3">
                <mat-panel-title class="flex items-center gap-2 font-medium">
                  Week {{ week.weekNumber }}
                  @if (week.isTaperWeek) {
                    <span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Taper</span>
                  } @else if (week.isCutbackWeek) {
                    <span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Recovery</span>
                  }
                </mat-panel-title>
                <mat-panel-description class="text-sm">
                  {{ week.startDate | date:'MMM d' }}
                  &nbsp;&middot;&nbsp;
                  {{ week.weeklyVolumeKm | number:'1.0-1' }} km planned
                  @if (completedSessionCount(week.id) > 0) {
                    &nbsp;&middot;&nbsp;
                    <span class="text-green-600">{{ completedSessionCount(week.id) }}/{{ weekSessionCount(week.id) }} done</span>
                  }
                  @if (skippedSessionCount(week.id) > 0) {
                    &nbsp;&middot;&nbsp;
                    <span class="text-amber-600">{{ skippedSessionCount(week.id) }} skipped</span>
                  }
                </mat-panel-description>
              </mat-expansion-panel-header>

              @if (week.focus) {
                <p class="text-sm text-gray-500 italic mb-4 px-1">{{ week.focus }}</p>
              }

              <!-- Sessions drag-and-drop list -->
              <div
                cdkDropList
                [cdkDropListData]="sessionsForWeek(week.id)"
                (cdkDropListDropped)="onDrop($event, week)"
                class="flex flex-col gap-2 min-h-[40px]"
              >
                @for (session of sessionsForWeek(week.id); track session.id) {
                  <div
                    cdkDrag
                    class="session-card group relative rounded-lg border transition-all cursor-grab active:cursor-grabbing overflow-hidden"
                    [class.border-gray-200]="!session.skipped"
                    [class.bg-white]="!session.skipped"
                    [class.hover:border-gray-300]="!session.skipped"
                    [class.hover:shadow-sm]="!session.skipped"
                    [class.border-amber-200]="session.skipped"
                    [class.bg-amber-50]="session.skipped"
                    [class.opacity-60]="session.completed"
                  >
                    <!-- Main row -->
                    <div class="flex items-start gap-3 p-3">
                      <!-- Drag handle -->
                      <div cdkDragHandle class="mt-0.5 cursor-grab text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                        <mat-icon class="!w-4 !h-4 text-sm">drag_indicator</mat-icon>
                      </div>

                      <!-- Session type badge -->
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5"
                        [class]="sessionConfig(session.sessionType).bgColor + ' ' + sessionConfig(session.sessionType).color"
                      >
                        <mat-icon class="!w-3 !h-3 text-xs">{{ sessionConfig(session.sessionType).icon }}</mat-icon>
                        {{ sessionConfig(session.sessionType).label }}
                      </span>

                      <!-- Session content -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 flex-wrap">
                          <span class="text-sm font-medium" [class.text-gray-800]="!session.skipped" [class.text-amber-800]="session.skipped">
                            {{ session.date | date:'EEE, MMM d' }}
                          </span>
                          @if (session.plannedDistanceKm) {
                            <span class="text-sm text-gray-600">
                              {{ session.plannedDistanceKm | number:'1.0-1' }} km
                            </span>
                          }
                          @if (session.plannedDurationMin) {
                            <span class="text-sm text-gray-500">
                              {{ session.plannedDurationMin }} min
                            </span>
                          }
                          @if (session.skipped) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              <mat-icon class="!w-3 !h-3">block</mat-icon>
                              Skipped
                            </span>
                          }
                        </div>
                        @if (session.description) {
                          <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">{{ session.description }}</p>
                        }
                      </div>

                      <!-- Action buttons -->
                      <div class="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        @if (!session.skipped) {
                          <!-- Skip button -->
                          <button
                            class="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                            matTooltip="Mark as skipped"
                            (click)="skipSession(session, $event)"
                          >
                            <mat-icon class="!w-4 !h-4 text-sm">block</mat-icon>
                          </button>

                          <!-- Complete button -->
                          <button
                            class="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                            [class.border-green-500]="session.completed"
                            [class.bg-green-500]="session.completed"
                            [class.border-gray-300]="!session.completed"
                            [matTooltip]="session.completed ? 'Mark incomplete' : 'Mark complete'"
                            (click)="toggleComplete(session, $event)"
                          >
                            @if (session.completed) {
                              <mat-icon class="!w-3 !h-3 text-white text-xs">check</mat-icon>
                            }
                          </button>
                        } @else {
                          <!-- Undo skip button -->
                          <button
                            class="w-7 h-7 flex items-center justify-center rounded-full text-amber-500 hover:bg-amber-100 transition-colors"
                            matTooltip="Undo skip"
                            (click)="unskipSession(session, $event)"
                          >
                            <mat-icon class="!w-4 !h-4 text-sm">undo</mat-icon>
                          </button>
                        }
                      </div>
                    </div>

                    <!-- Strava URL section (shown when skipped) -->
                    @if (session.skipped) {
                      <div class="border-t border-amber-100 px-3 py-2">
                        @if (skippingSessionId() === session.id) {
                          <!-- URL input form -->
                          <div class="flex items-center gap-2">
                            <mat-icon class="!w-4 !h-4 text-amber-500 flex-shrink-0">add_link</mat-icon>
                            <input
                              #urlInput
                              type="url"
                              placeholder="Paste Strava activity URL (optional)"
                              class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 bg-white"
                              [value]="session.stravaActivityUrl ?? ''"
                              (keydown.enter)="saveStravaUrl(session, urlInput.value)"
                              (keydown.escape)="skippingSessionId.set(null)"
                            />
                            <button
                              mat-stroked-button
                              class="!text-xs !h-7 !min-w-0 !px-2"
                              (click)="saveStravaUrl(session, urlInput.value)"
                            >Save</button>
                            <button
                              class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
                              (click)="skippingSessionId.set(null)"
                            >
                              <mat-icon class="!w-4 !h-4">close</mat-icon>
                            </button>
                          </div>
                        } @else {
                          <!-- Saved state: show link or add-link prompt -->
                          <div class="flex items-center gap-2">
                            @if (session.stravaActivityUrl) {
                              <mat-icon class="!w-3.5 !h-3.5 text-orange-500 flex-shrink-0">open_in_new</mat-icon>
                              <a
                                [href]="session.stravaActivityUrl"
                                target="_blank"
                                rel="noopener"
                                class="text-xs text-orange-600 hover:underline flex-1 truncate"
                                (click)="$event.stopPropagation()"
                              >View on Strava</a>
                              <button
                                class="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                                (click)="openStravaUrlInput(session, $event)"
                              >Edit</button>
                            } @else {
                              <button
                                class="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors"
                                (click)="openStravaUrlInput(session, $event)"
                              >
                                <mat-icon class="!w-3.5 !h-3.5">add_link</mat-icon>
                                Add Strava link
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @empty {
                  <p class="text-sm text-gray-400 text-center py-4">No sessions scheduled for this week.</p>
                }
              </div>
            </mat-expansion-panel>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .cdk-drag-preview {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      opacity: 0.95;
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drop-list-dragging .session-card:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
})
export class PlanDetailComponent implements OnInit {
  @Input() id!: string;

  private readonly plansService = inject(PlansService);
  private readonly snackBar = inject(MatSnackBar);

  plan = signal<TrainingPlanDetail | null>(null);
  loading = signal(true);
  activating = signal(false);

  /** Tracks which session (by id) is showing the Strava URL input */
  readonly skippingSessionId = signal<string | null>(null);

  // Local mutable sessions state for optimistic UI updates
  private readonly _sessionsByWeek = signal<Map<string, TrainingSession[]>>(new Map());

  readonly peakVolumeKm = computed(() => {
    const weeks = this.plan()?.weeks ?? [];
    return Math.max(0, ...weeks.map((w) => w.weeklyVolumeKm));
  });

  readonly sessionConfig = (type: TrainingSession['sessionType']) =>
    SESSION_TYPE_CONFIG[type];

  ngOnInit() {
    this.plansService.loadPlan(this.id).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this._sessionsByWeek.set(this.plansService.groupSessionsByWeek(plan.sessions));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  sessionsForWeek(weekId: string): TrainingSession[] {
    return this._sessionsByWeek().get(weekId) ?? [];
  }

  weekSessionCount(weekId: string): number {
    return this.sessionsForWeek(weekId).length;
  }

  completedSessionCount(weekId: string): number {
    return this.sessionsForWeek(weekId).filter((s) => s.completed).length;
  }

  skippedSessionCount(weekId: string): number {
    return this.sessionsForWeek(weekId).filter((s) => s.skipped).length;
  }

  isCurrentWeek(week: TrainingWeek): boolean {
    const today = new Date();
    const start = new Date(week.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return today >= start && today <= end;
  }

  onDrop(event: CdkDragDrop<TrainingSession[]>, week: TrainingWeek) {
    if (event.previousIndex === event.currentIndex) return;

    const sessions = [...this.sessionsForWeek(week.id)];
    moveItemInArray(sessions, event.previousIndex, event.currentIndex);

    // Reassign dates based on new order (keeping within the same week)
    const weekStart = new Date(week.startDate);
    const updatedSessions = sessions.map((session, index) => {
      const newDate = new Date(weekStart);
      newDate.setDate(weekStart.getDate() + index);
      return { ...session, date: newDate.toISOString().split('T')[0] };
    });

    // Optimistic update
    this._sessionsByWeek.update((map) => {
      const newMap = new Map(map);
      newMap.set(week.id, updatedSessions);
      return newMap;
    });

    // Persist each changed session to the backend
    const planId = this.plan()!.id;
    updatedSessions.forEach((session, index) => {
      if (sessions[index]?.date !== session.date) {
        this.plansService
          .updateSession(planId, session.id, { date: session.date })
          .subscribe({
            error: () => {
              this.snackBar.open('Failed to save session order. Please refresh.', 'Close', {
                duration: 4000,
              });
              this.ngOnInit();
            },
          });
      }
    });
  }

  toggleComplete(session: TrainingSession, event: Event) {
    event.stopPropagation();
    const planId = this.plan()!.id;
    const newValue = !session.completed;

    this._updateSessionOptimistic(session, { completed: newValue });

    this.plansService.updateSession(planId, session.id, { completed: newValue }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { completed: session.completed });
        this.snackBar.open('Failed to update session.', 'Close', { duration: 3000 });
      },
    });
  }

  skipSession(session: TrainingSession, event: Event) {
    event.stopPropagation();
    const planId = this.plan()!.id;

    this._updateSessionOptimistic(session, { skipped: true, completed: false });
    this.skippingSessionId.set(null);

    this.plansService.updateSession(planId, session.id, { skipped: true, completed: false }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { skipped: session.skipped, completed: session.completed });
        this.snackBar.open('Failed to skip session.', 'Close', { duration: 3000 });
      },
    });
  }

  unskipSession(session: TrainingSession, event: Event) {
    event.stopPropagation();
    const planId = this.plan()!.id;
    this.skippingSessionId.set(null);

    this._updateSessionOptimistic(session, { skipped: false });

    this.plansService.updateSession(planId, session.id, { skipped: false }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { skipped: session.skipped });
        this.snackBar.open('Failed to undo skip.', 'Close', { duration: 3000 });
      },
    });
  }

  openStravaUrlInput(session: TrainingSession, event: Event) {
    event.stopPropagation();
    this.skippingSessionId.set(session.id);
  }

  saveStravaUrl(session: TrainingSession, url: string) {
    const planId = this.plan()!.id;
    const trimmed = url.trim();
    this.skippingSessionId.set(null);

    this._updateSessionOptimistic(session, { stravaActivityUrl: trimmed || null });

    this.plansService
      .updateSession(planId, session.id, { stravaActivityUrl: trimmed || undefined })
      .subscribe({
        error: () => {
          this._updateSessionOptimistic(session, { stravaActivityUrl: session.stravaActivityUrl });
          this.snackBar.open('Failed to save Strava link.', 'Close', { duration: 3000 });
        },
      });
  }

  private _updateSessionOptimistic(session: TrainingSession, patch: Partial<TrainingSession>) {
    this._sessionsByWeek.update((map) => {
      const newMap = new Map(map);
      const sessions = (newMap.get(session.weekId) ?? []).map((s) =>
        s.id === session.id ? { ...s, ...patch } : s,
      );
      newMap.set(session.weekId, sessions);
      return newMap;
    });
  }

  activate() {
    this.activating.set(true);
    this.plansService.activatePlan(this.id).subscribe({
      next: () => {
        this.plan.update((p) => (p ? { ...p, isActive: true } : null));
        this.activating.set(false);
        this.snackBar.open('Plan set as active.', 'Close', { duration: 3000 });
      },
      error: () => {
        this.activating.set(false);
        this.snackBar.open('Failed to activate plan.', 'Close', { duration: 3000 });
      },
    });
  }
}
