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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  CdkDragDrop,
  DragDropModule,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  PlansService,
  TrainingPlanDetail,
  TrainingSession,
  SESSION_TYPE_CONFIG,
} from '../../shared/services/plans.service';

type CalendarView = 'week' | 'month';

interface DayCell {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isToday: boolean;
  isInPlan: boolean;
  sessions: TrainingSession[];
}

@Component({
  selector: 'app-plan-calendar',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    DragDropModule,
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (!plan()) {
        <div class="p-8 text-center">
          <mat-icon class="text-5xl text-gray-300 mb-4 block" style="font-size:3rem;height:3rem;width:3rem;">error_outline</mat-icon>
          <h3 class="text-lg font-medium mb-2">Plan not found</h3>
          <a mat-stroked-button routerLink="/plans">Back to plans</a>
        </div>
      } @else {
        <!-- Header -->
        <div class="mb-6">
          <a [routerLink]="['/plans', plan()!.id]" class="text-sm text-gray-500 hover:underline flex items-center gap-1 w-fit mb-3">
            <mat-icon class="text-sm !w-4 !h-4">arrow_back</mat-icon>
            Back to plan
          </a>
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 class="text-2xl font-bold">{{ plan()!.name }}</h1>
              <p class="text-gray-600 text-sm mt-0.5">{{ plan()!.goalEvent }} &middot; {{ plan()!.goalDate | date:'longDate' }}</p>
            </div>

            <div class="flex items-center gap-3">
              <!-- Week/Month toggle -->
              <mat-button-toggle-group [value]="view()" (change)="view.set($event.value)" aria-label="Calendar view">
                <mat-button-toggle value="week">
                  <mat-icon class="!w-4 !h-4 text-sm mr-1">view_week</mat-icon>
                  Week
                </mat-button-toggle>
                <mat-button-toggle value="month">
                  <mat-icon class="!w-4 !h-4 text-sm mr-1">calendar_month</mat-icon>
                  Month
                </mat-button-toggle>
              </mat-button-toggle-group>

              <!-- Navigation -->
              <div class="flex items-center gap-1">
                <button mat-icon-button (click)="navigate(-1)" matTooltip="Previous">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <button mat-stroked-button (click)="goToToday()" class="text-sm">Today</button>
                <button mat-icon-button (click)="navigate(1)" matTooltip="Next">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- Period label -->
          <p class="text-base font-medium text-gray-700 mt-3">{{ periodLabel() }}</p>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-3 mb-4">
          @for (entry of sessionTypes; track entry.type) {
            <div class="flex items-center gap-1.5 text-xs">
              <span class="w-2.5 h-2.5 rounded-full {{ entry.config.bgColor.replace('bg-', 'bg-') }}" [style.background]="entry.dot"></span>
              <span class="text-gray-600">{{ entry.config.label }}</span>
            </div>
          }
          <div class="flex items-center gap-1.5 text-xs">
            <span class="w-2.5 h-2.5 rounded-full bg-green-400"></span>
            <span class="text-gray-600">Completed</span>
          </div>
        </div>

        <!-- Week view -->
        @if (view() === 'week') {
          <div class="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            <!-- Day headers -->
            @for (day of DAY_NAMES; track day) {
              <div class="bg-gray-50 px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {{ day }}
              </div>
            }

            <!-- Day cells -->
            @for (cell of weekCells(); track cell.dateStr) {
              <div
                cdkDropList
                [id]="cell.dateStr"
                [cdkDropListData]="cell.sessions"
                [cdkDropListConnectedTo]="dropListIds()"
                (cdkDropListDropped)="onDrop($event, cell)"
                class="bg-white min-h-[160px] p-2 flex flex-col gap-1.5 relative"
                [class.bg-blue-50]="cell.isToday"
                [class.opacity-40]="!cell.isInPlan"
              >
                <!-- Date number -->
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full"
                    [class.bg-blue-600]="cell.isToday"
                    [class.text-white]="cell.isToday"
                    [class.text-gray-700]="!cell.isToday"
                  >{{ cell.date.getDate() }}</span>
                </div>

                <!-- Sessions -->
                @for (session of cell.sessions; track session.id) {
                  <div
                    cdkDrag
                    [cdkDragData]="session"
                    [cdkDragDisabled]="!cell.isInPlan"
                    class="session-pill group relative rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
                    [ngClass]="sessionClass(session)"
                    [matTooltip]="sessionTooltip(session)"
                  >
                    <div *cdkDragPlaceholder class="rounded px-2 py-1.5 opacity-30 bg-gray-200 text-xs">&nbsp;</div>
                    <div class="flex items-center gap-1">
                      <mat-icon class="!w-3 !h-3 !text-xs flex-shrink-0">{{ sessionIcon(session) }}</mat-icon>
                      <span class="font-medium truncate">{{ sessionLabel(session) }}</span>
                      @if (session.completed) {
                        <mat-icon class="!w-3 !h-3 !text-xs flex-shrink-0 text-green-600 ml-auto">check_circle</mat-icon>
                      }
                    </div>
                    @if (session.plannedDistanceKm) {
                      <div class="text-[10px] opacity-75 mt-0.5">{{ session.plannedDistanceKm | number:'1.0-1' }} km</div>
                    }
                  </div>
                }

                @if (cell.sessions.length === 0 && cell.isInPlan) {
                  <div class="text-[11px] text-gray-300 text-center mt-auto mb-auto">Rest</div>
                }
              </div>
            }
          </div>
        }

        <!-- Month view -->
        @if (view() === 'month') {
          <div class="rounded-xl overflow-hidden border border-gray-200">
            <!-- Day headers -->
            <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              @for (day of DAY_NAMES; track day) {
                <div class="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {{ day }}
                </div>
              }
            </div>

            <!-- Month grid -->
            <div class="grid grid-cols-7 divide-x divide-y divide-gray-100">
              @for (cell of monthCells(); track cell.dateStr) {
                <div
                  cdkDropList
                  [id]="cell.dateStr"
                  [cdkDropListData]="cell.sessions"
                  [cdkDropListConnectedTo]="dropListIds()"
                  (cdkDropListDropped)="onDrop($event, cell)"
                  class="min-h-[100px] p-1.5 flex flex-col gap-1 relative"
                  [class.bg-blue-50]="cell.isToday"
                  [class.bg-gray-50]="!cell.isInPlan && !cell.isToday"
                >
                  <!-- Date number -->
                  <span
                    class="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-start"
                    [class.bg-blue-600]="cell.isToday"
                    [class.text-white]="cell.isToday"
                    [class.text-gray-400]="!cell.isInPlan && !cell.isToday"
                    [class.text-gray-700]="cell.isInPlan && !cell.isToday"
                  >{{ cell.date.getDate() }}</span>

                  <!-- Sessions -->
                  @for (session of cell.sessions; track session.id) {
                    <div
                      cdkDrag
                      [cdkDragData]="session"
                      [cdkDragDisabled]="!cell.isInPlan"
                      class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-grab active:cursor-grabbing flex items-center gap-0.5 truncate"
                      [ngClass]="sessionClass(session)"
                      [matTooltip]="sessionTooltip(session)"
                    >
                      <div *cdkDragPlaceholder class="rounded px-1.5 py-0.5 opacity-30 bg-gray-200 text-[10px]">&nbsp;</div>
                      <mat-icon class="!w-3 !h-3 !text-[10px] flex-shrink-0">{{ sessionIcon(session) }}</mat-icon>
                      <span class="truncate">{{ sessionLabel(session) }}</span>
                      @if (session.completed) {
                        <mat-icon class="!w-3 !h-3 !text-[10px] flex-shrink-0 ml-auto">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    .cdk-drop-list-dragging .session-pill:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
  `],
})
export class PlanCalendarComponent implements OnInit {
  @Input() id!: string;

  private readonly plansService = inject(PlansService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly plan = signal<TrainingPlanDetail | null>(null);
  readonly view = signal<CalendarView>('week');
  readonly cursor = signal<Date>(new Date());

  readonly DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly sessionTypes = (Object.entries(SESSION_TYPE_CONFIG) as [string, (typeof SESSION_TYPE_CONFIG)[keyof typeof SESSION_TYPE_CONFIG]][])
    .filter(([t]) => t !== 'rest')
    .map(([type, config]) => ({ type, config, dot: this.dotColor(type) }));

  ngOnInit() {
    this.plansService.loadPlan(this.id).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.loading.set(false);
        // Default cursor to plan start date or today if within plan
        const planStart = new Date(p.weeks[0]?.startDate ?? new Date());
        const planEnd = new Date(p.goalDate);
        const today = new Date();
        this.cursor.set(today >= planStart && today <= planEnd ? today : planStart);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  navigate(dir: -1 | 1) {
    const d = new Date(this.cursor());
    if (this.view() === 'week') {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setMonth(d.getMonth() + dir);
    }
    this.cursor.set(d);
  }

  goToToday() {
    this.cursor.set(new Date());
  }

  // ─── Computed cells ───────────────────────────────────────────────────────

  readonly weekCells = computed<DayCell[]>(() => {
    const p = this.plan();
    if (!p) return [];
    const monday = this.getMondayOf(this.cursor());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      return this.buildCell(date, p);
    });
  });

  readonly monthCells = computed<DayCell[]>(() => {
    const p = this.plan();
    if (!p) return [];
    const d = this.cursor();
    const year = d.getFullYear();
    const month = d.getMonth();

    // First day of month, then back to Monday
    const firstDay = new Date(year, month, 1);
    const startCell = this.getMondayOf(firstDay);

    // Last day of month, forward to Sunday
    const lastDay = new Date(year, month + 1, 0);
    const endCell = this.getSundayOf(lastDay);

    const cells: DayCell[] = [];
    const cur = new Date(startCell);
    while (cur <= endCell) {
      cells.push(this.buildCell(new Date(cur), p));
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  });

  readonly periodLabel = computed(() => {
    const d = this.cursor();
    if (this.view() === 'week') {
      const monday = this.getMondayOf(d);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const year = sunday.getFullYear();
      return `${fmt(monday)} – ${fmt(sunday)}, ${year}`;
    } else {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  });

  readonly dropListIds = computed<string[]>(() => {
    const cells = this.view() === 'week' ? this.weekCells() : this.monthCells();
    return cells.map((c) => c.dateStr);
  });

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  onDrop(event: CdkDragDrop<TrainingSession[]>, targetCell: DayCell) {
    if (!targetCell.isInPlan) return;
    if (event.previousContainer === event.container) return;

    const session: TrainingSession = event.item.data;
    if (session.date === targetCell.dateStr) return;

    // Optimistic UI update
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Update session in plan signal for re-render
    const p = this.plan();
    if (!p) return;

    const updatedSessions = p.sessions.map((s) =>
      s.id === session.id ? { ...s, date: targetCell.dateStr } : s,
    );
    this.plan.set({ ...p, sessions: updatedSessions });

    // Persist
    this.plansService.updateSession(p.id, session.id, { date: targetCell.dateStr }).subscribe({
      error: () => {
        // Revert
        const revertedSessions = (this.plan()?.sessions ?? []).map((s) =>
          s.id === session.id ? { ...s, date: session.date } : s,
        );
        this.plan.set({ ...p, sessions: revertedSessions });
        this.snackBar.open('Failed to move session. Please try again.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildCell(date: Date, p: TrainingPlanDetail): DayCell {
    const dateStr = this.toDateStr(date);
    const today = this.toDateStr(new Date());
    const planStart = p.weeks[0]?.startDate ?? '';
    const planEnd = p.goalDate;
    return {
      date,
      dateStr,
      isToday: dateStr === today,
      isInPlan: dateStr >= planStart && dateStr <= planEnd,
      sessions: p.sessions.filter((s) => s.date === dateStr),
    };
  }

  private getMondayOf(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day);
    result.setDate(result.getDate() + diff);
    return result;
  }

  private getSundayOf(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    result.setDate(result.getDate() + diff);
    return result;
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  sessionClass(session: TrainingSession): string {
    if (session.skipped) return 'bg-amber-100 text-amber-700 opacity-75 line-through';
    const cfg = SESSION_TYPE_CONFIG[session.sessionType];
    if (session.stravaActivity) return `${cfg.bgColor} ${cfg.color} ring-1 ring-orange-300`;
    if (session.completed) return `${cfg.bgColor} ${cfg.color} opacity-75`;
    return `${cfg.bgColor} ${cfg.color}`;
  }

  sessionLabel(session: TrainingSession): string {
    return SESSION_TYPE_CONFIG[session.sessionType].label;
  }

  sessionIcon(session: TrainingSession): string {
    return SESSION_TYPE_CONFIG[session.sessionType].icon;
  }

  sessionTooltip(session: TrainingSession): string {
    const cfg = SESSION_TYPE_CONFIG[session.sessionType];
    const parts = [cfg.label];
    if (session.plannedDistanceKm) parts.push(`${session.plannedDistanceKm.toFixed(1)} km`);
    if (session.plannedDurationMin) parts.push(`~${session.plannedDurationMin} min`);
    if (session.description) parts.push(session.description);
    if (session.completed) parts.push('✓ Completed');
    if (session.skipped) parts.push('⊘ Skipped');
    if (session.stravaActivity) parts.push(`🏃 ${session.stravaActivity.name} (${(session.stravaActivity.distance / 1000).toFixed(1)} km)`);
    return parts.join(' · ');
  }

  private dotColor(type: string): string {
    const map: Record<string, string> = {
      easy_run: '#15803d', long_run: '#1d4ed8', tempo: '#c2410c',
      intervals: '#b91c1c', recovery: '#0f766e', race: '#7e22ce',
    };
    return map[type] ?? '#6b7280';
  }
}
