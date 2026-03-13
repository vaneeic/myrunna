import {
  Component,
  signal,
  computed,
  OnInit,
  Input,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  PlansService,
  Race,
  TrainingPlanDetail,
  TrainingSession,
  TrainingWeek,
  SESSION_TYPE_CONFIG,
  CreateRacePayload,
} from '../../shared/services/plans.service';
import { StravaService, StravaActivity } from '../../shared/services/strava.service';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DecimalPipe,
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
    FormsModule,
    DragDropModule,
  ],
  template: `
    <div class="min-h-screen bg-slate-50">
      @if (loading()) {
        <div class="flex items-center justify-center py-32">
          <mat-spinner diameter="36"></mat-spinner>
        </div>
      } @else if (!plan()) {
        <div class="max-w-2xl mx-auto px-6 py-16 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <mat-icon class="text-slate-400 !w-8 !h-8 text-3xl">search_off</mat-icon>
          </div>
          <h3 class="text-lg font-semibold text-slate-800 mb-1">Plan not found</h3>
          <p class="text-sm text-slate-500 mb-6">This plan doesn't exist or you don't have access.</p>
          <a mat-flat-button routerLink="/plans">Back to plans</a>
        </div>
      } @else {

        <!-- Hero header -->
        <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <div class="max-w-4xl mx-auto px-6 py-8">
            <a routerLink="/plans" class="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-6">
              <mat-icon class="!w-4 !h-4 text-sm">arrow_back</mat-icon>
              All plans
            </a>
            <div class="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <h1 class="text-3xl font-extrabold tracking-tight" style="font-family: Manrope, Inter, sans-serif">{{ plan()!.name }}</h1>
                  @if (plan()!.isActive) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                      Active
                    </span>
                  }
                </div>
                <p class="text-slate-300 text-sm mb-4">{{ plan()!.goalEvent }} &middot; {{ plan()!.goalDate | date:'MMMM d, yyyy' }}</p>
                <!-- Stats row -->
                <div class="flex gap-4 flex-wrap">
                  <div class="bg-white/10 rounded-xl px-4 py-2.5">
                    <p class="text-xs text-slate-400 uppercase tracking-wide font-medium">Weeks</p>
                    <p class="text-xl font-bold">{{ plan()!.weeks.length }}</p>
                  </div>
                  <div class="bg-white/10 rounded-xl px-4 py-2.5">
                    <p class="text-xs text-slate-400 uppercase tracking-wide font-medium">Peak volume</p>
                    <p class="text-xl font-bold">{{ peakVolumeKm() | number:'1.0-1' }} <span class="text-sm font-normal text-slate-300">km/wk</span></p>
                  </div>
                  <div class="bg-white/10 rounded-xl px-4 py-2.5">
                    <p class="text-xs text-slate-400 uppercase tracking-wide font-medium">B-races</p>
                    <p class="text-xl font-bold">{{ bRaces().length }}</p>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <a
                  mat-stroked-button
                  [routerLink]="['/plans', plan()!.id, 'calendar']"
                  class="!text-white !border-white/30 hover:!bg-white/10"
                >
                  <mat-icon>calendar_month</mat-icon>
                  Calendar
                </a>
                @if (!plan()!.isActive) {
                  <button
                    mat-flat-button
                    class="!bg-[#f07561] !text-white"
                    (click)="activate()"
                    [disabled]="activating()"
                  >
                    Set as active
                  </button>
                }
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-4xl mx-auto px-6 py-8">

          <!-- Weeks -->
          <div class="flex flex-col gap-2 mb-10">
            @for (week of plan()!.weeks; track week.id) {
              <mat-expansion-panel
                [expanded]="isCurrentWeek(week)"
                class="!rounded-2xl !shadow-none !border overflow-hidden"
                [class.!border-slate-200]="!isCurrentWeek(week)"
                [style.border-color]="isCurrentWeek(week) ? '#f07561' : null"
                [class.!shadow-md]="isCurrentWeek(week)"
                [class.border-l-4]="week.isTaperWeek || week.isCutbackWeek"
                [class.!border-l-blue-400]="week.isTaperWeek"
                [class.!border-l-amber-400]="week.isCutbackWeek && !week.isTaperWeek"
              >
                <mat-expansion-panel-header class="!py-4 !px-5">
                  <mat-panel-title class="flex items-center gap-3">
                    <!-- Week number circle -->
                    <span
                      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      [style.background-color]="isCurrentWeek(week) ? '#f07561' : null"
                      [class.text-white]="isCurrentWeek(week)"
                      [class.bg-slate-100]="!isCurrentWeek(week)"
                      [class.text-slate-600]="!isCurrentWeek(week)"
                    >{{ week.weekNumber }}</span>
                    <span class="font-semibold text-slate-800 text-sm">
                      {{ week.startDate | date:'MMM d' }} – {{ weekEndDate(week.startDate) | date:'MMM d' }}
                      @if (isCurrentWeek(week)) {
                        <span class="ml-2 text-[#f07561] text-xs font-medium">Current week</span>
                      }
                    </span>
                    @if (week.isTaperWeek) {
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Taper</span>
                    } @else if (week.isCutbackWeek) {
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Recovery</span>
                    }
                  </mat-panel-title>
                  <mat-panel-description class="flex items-center gap-3 text-xs text-slate-500">
                    <span class="font-semibold text-slate-700">{{ week.weeklyVolumeKm | number:'1.0-1' }} km</span>
                    @if (completedSessionCount(week.id) > 0) {
                      <span class="text-emerald-600 font-medium">{{ completedSessionCount(week.id) }}/{{ weekSessionCount(week.id) }} done</span>
                    }
                    @if (skippedSessionCount(week.id) > 0) {
                      <span class="text-amber-600">{{ skippedSessionCount(week.id) }} skipped</span>
                    }
                  </mat-panel-description>
                </mat-expansion-panel-header>

                @if (week.focus) {
                  <p class="text-xs text-slate-400 italic mb-3 px-5">{{ week.focus }}</p>
                }

                <!-- Sessions -->
                <div
                  cdkDropList
                  [cdkDropListData]="sessionsForWeek(week.id)"
                  (cdkDropListDropped)="onDrop($event, week)"
                  class="flex flex-col gap-1.5 px-3 pb-3 min-h-[40px]"
                >
                  @for (session of sessionsForWeek(week.id); track session.id) {
                    <div
                      cdkDrag
                      class="session-card group relative rounded-xl border transition-all cursor-grab active:cursor-grabbing overflow-hidden bg-white hover:border-slate-200 hover:shadow-sm"
                      [class.border-slate-100]="!session.skipped && !session.stravaActivity"
                      [class.border-amber-200]="session.skipped"
                      [class.bg-amber-50]="session.skipped"
                      [class.border-emerald-200]="!session.skipped && !!session.stravaActivity"
                      [class.bg-emerald-50]="!session.skipped && !!session.stravaActivity"
                      [class.opacity-50]="session.completed && !session.stravaActivity"
                    >
                      <!-- Colored left accent bar -->
                      <div
                        class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                        [class.bg-green-400]="session.sessionType === 'easy_run'"
                        [class.bg-blue-500]="session.sessionType === 'long_run'"
                        [class.bg-orange-500]="session.sessionType === 'tempo'"
                        [class.bg-rose-500]="session.sessionType === 'intervals'"
                        [class.bg-teal-400]="session.sessionType === 'recovery'"
                        [class.bg-violet-500]="session.sessionType === 'race'"
                        [class.bg-slate-300]="session.sessionType === 'rest'"
                      ></div>

                      <!-- Main row -->
                      <div class="flex items-center gap-3 pl-4 pr-3 py-3">
                        <!-- Drag handle -->
                        <div cdkDragHandle class="cursor-grab text-slate-200 hover:text-slate-400 transition-colors flex-shrink-0">
                          <mat-icon class="!w-4 !h-4 text-sm">drag_indicator</mat-icon>
                        </div>

                        <!-- Date -->
                        <span class="text-xs font-semibold text-slate-400 w-14 flex-shrink-0">
                          {{ session.date | date:'EEE d' }}
                        </span>

                        <!-- Session type badge -->
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold flex-shrink-0"
                          [class]="sessionConfig(session.sessionType).bgColor + ' ' + sessionConfig(session.sessionType).color"
                        >
                          {{ sessionConfig(session.sessionType).label }}
                        </span>

                        <!-- Description -->
                        <div class="flex-1 min-w-0">
                          @if (session.description) {
                            <p class="text-xs text-slate-500 truncate">{{ session.description }}</p>
                          }
                        </div>

                        <!-- Distance / duration -->
                        <div class="flex items-center gap-2 flex-shrink-0 text-xs text-slate-600 font-medium">
                          @if (session.plannedDistanceKm) {
                            <span>{{ session.plannedDistanceKm | number:'1.0-1' }} km</span>
                          }
                          @if (session.plannedDurationMin) {
                            <span class="text-slate-400">{{ session.plannedDurationMin }}min</span>
                          }
                          @if (session.skipped) {
                            <span class="px-1.5 py-0.5 rounded-md text-xs bg-amber-100 text-amber-700 font-semibold">Skipped</span>
                          }
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-0.5 flex-shrink-0">
                          @if (session.skipped) {
                            <button class="w-7 h-7 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-100 transition-colors" matTooltip="Undo skip" (click)="unskipSession(session, $event)">
                              <mat-icon class="!w-4 !h-4 text-sm">undo</mat-icon>
                            </button>
                          } @else {
                            <button
                              class="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-orange-50"
                              [style.color]="!!session.stravaActivity ? '#f07561' : null"
                              [class.text-slate-300]="!session.stravaActivity"
                              [matTooltip]="session.stravaActivity ? 'Change linked activity' : 'Link Strava activity'"
                              (click)="openActivityPicker(session, $event)"
                            >
                              <mat-icon class="!w-4 !h-4 text-sm">link</mat-icon>
                            </button>
                            <button class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors" matTooltip="Skip session" (click)="skipSession(session, $event)">
                              <mat-icon class="!w-4 !h-4 text-sm">block</mat-icon>
                            </button>
                            <button
                              class="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                              [class.border-emerald-500]="session.completed"
                              [class.bg-emerald-500]="session.completed"
                              [class.border-slate-200]="!session.completed"
                              [matTooltip]="session.completed ? 'Mark incomplete' : 'Mark complete'"
                              (click)="toggleComplete(session, $event)"
                            >
                              @if (session.completed) {
                                <mat-icon class="!w-3 !h-3 text-white text-xs">check</mat-icon>
                              }
                            </button>
                          }
                        </div>
                      </div>

                      <!-- Linked Strava bar -->
                      @if (session.stravaActivity) {
                        <div class="border-t border-emerald-100 bg-emerald-50/80 px-4 py-2 flex items-center gap-2">
                          <mat-icon class="!w-3.5 !h-3.5 text-[#f07561] flex-shrink-0">directions_run</mat-icon>
                          <span class="text-xs text-emerald-800 font-semibold truncate flex-1">{{ session.stravaActivity.name }}</span>
                          <span class="text-xs text-emerald-600 flex-shrink-0">
                            {{ (session.stravaActivity.distance / 1000) | number:'1.1-2' }} km &middot; {{ session.stravaActivity.startDate | date:'MMM d' }}
                          </span>
                          <button class="text-slate-400 hover:text-rose-500 flex-shrink-0 transition-colors" matTooltip="Unlink" (click)="unlinkActivity(session, $event)">
                            <mat-icon class="!w-3.5 !h-3.5">link_off</mat-icon>
                          </button>
                        </div>
                      }

                      <!-- Activity picker -->
                      @if (pickingSessionId() === session.id) {
                        <div class="border-t border-slate-100 bg-white px-4 py-3" (click)="$event.stopPropagation()">
                          <div class="flex items-center justify-between mb-2.5">
                            <span class="text-xs font-semibold text-slate-700">Link a Strava activity</span>
                            <button class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded" (click)="pickingSessionId.set(null)">
                              <mat-icon class="!w-4 !h-4">close</mat-icon>
                            </button>
                          </div>
                          @if (activitiesLoading()) {
                            <div class="flex items-center justify-center py-3"><mat-spinner diameter="20"></mat-spinner></div>
                          } @else if (filteredActivities().length === 0) {
                            <p class="text-xs text-slate-400 py-2 text-center">No run activities found. <a routerLink="/strava" class="text-[#f07561] hover:underline">Sync from Strava</a> first.</p>
                          } @else {
                            <input type="text" placeholder="Search activities…" class="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:border-[#f07561] transition-colors" [(ngModel)]="activitySearchQuery" />
                            <div class="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                              @for (act of filteredActivities(); track act.id) {
                                <button
                                  class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-orange-50 text-left transition-colors w-full"
                                  [class.bg-orange-50]="session.stravaActivityId === act.stravaId"
                                  [class.ring-1]="session.stravaActivityId === act.stravaId"
                                  [style.outline]="session.stravaActivityId === act.stravaId ? '2px solid #f07561' : null"
                                  (click)="linkActivity(session, act)"
                                >
                                  <mat-icon class="!w-3.5 !h-3.5 text-[#f07561] flex-shrink-0">directions_run</mat-icon>
                                  <span class="text-xs text-slate-800 font-medium flex-1 truncate">{{ act.name }}</span>
                                  <span class="text-xs text-slate-400 flex-shrink-0">{{ (act.distance / 1000) | number:'1.1-1' }} km &middot; {{ act.startDate | date:'MMM d' }}</span>
                                </button>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } @empty {
                    <p class="text-xs text-slate-400 text-center py-6">No sessions this week.</p>
                  }
                </div>
              </mat-expansion-panel>
            }
          </div>

          <!-- ── Adapt Your Plan ─────────────────────────────────── -->
          <div>
            <div class="flex items-center gap-3 mb-5">
              <h2 class="text-xl font-bold text-slate-900" style="font-family: Manrope, Inter, sans-serif">Adapt Your Plan</h2>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 mb-6 flex-wrap">
              <button
                class="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                [class.bg-slate-900]="adaptTab() === 'races'"
                [class.text-white]="adaptTab() === 'races'"
                [class.shadow-md]="adaptTab() === 'races'"
                [class.bg-white]="adaptTab() !== 'races'"
                [class.text-slate-600]="adaptTab() !== 'races'"
                [class.border]="adaptTab() !== 'races'"
                [class.border-slate-200]="adaptTab() !== 'races'"
                (click)="adaptTab.set('races')"
              >
                <span class="flex items-center gap-1.5"><mat-icon class="!w-4 !h-4 text-sm">flag</mat-icon> B-races</span>
              </button>
              <button class="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-300 cursor-not-allowed flex items-center gap-1.5" disabled>
                <mat-icon class="!w-4 !h-4 text-sm">beach_access</mat-icon> Vacations
              </button>
              <button class="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-300 cursor-not-allowed flex items-center gap-1.5" disabled>
                <mat-icon class="!w-4 !h-4 text-sm">sentiment_dissatisfied</mat-icon> Not feeling 100%
              </button>
            </div>

            @if (adaptTab() === 'races') {
              <!-- Race cards row -->
              <div class="flex gap-3 flex-wrap mb-6">
                @if (!showAddRaceForm()) {
                  <button
                    class="border-2 border-dashed border-slate-200 rounded-2xl p-4 w-40 hover:border-[#f07561] hover:bg-orange-50/40 transition-all flex flex-col items-center justify-center gap-2 min-h-[110px] bg-white"
                    (click)="openAddRaceForm()"
                  >
                    <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      <mat-icon class="text-slate-400">add</mat-icon>
                    </div>
                    <span class="text-xs text-slate-500 text-center font-medium leading-tight">Add a B-race</span>
                  </button>
                }

                @for (race of bRaces(); track race.id) {
                  <button
                    class="rounded-2xl p-4 w-40 text-left transition-all flex flex-col gap-3 min-h-[110px] border"
                    [class.bg-white]="selectedBRaceId() !== race.id"
                    [class.border-slate-200]="selectedBRaceId() !== race.id"
                    [class.bg-slate-900]="selectedBRaceId() === race.id"
                    [class.border-slate-900]="selectedBRaceId() === race.id"
                    [class.shadow-lg]="selectedBRaceId() === race.id"
                    (click)="selectBRace(race)"
                  >
                    <div
                      class="w-8 h-8 rounded-xl flex items-center justify-center"
                      [class.bg-slate-100]="selectedBRaceId() !== race.id"
                      [style.background-color]="selectedBRaceId() === race.id ? 'rgba(255,255,255,0.15)' : null"
                    >
                      <mat-icon
                        class="!w-4 !h-4 text-sm"
                        [style.color]="selectedBRaceId() !== race.id ? '#f07561' : null"
                        [class.text-white]="selectedBRaceId() === race.id"
                      >flag</mat-icon>
                    </div>
                    <div>
                      <p class="text-sm font-bold leading-tight line-clamp-2" [class.text-slate-800]="selectedBRaceId() !== race.id" [class.text-white]="selectedBRaceId() === race.id">{{ race.name }}</p>
                      <p class="text-xs mt-1 font-medium" [class.text-slate-400]="selectedBRaceId() !== race.id" [class.text-slate-400]="selectedBRaceId() === race.id">{{ race.date | date:'MMM d, yyyy' }}</p>
                    </div>
                  </button>
                }
              </div>

              <!-- Add B-race form -->
              @if (showAddRaceForm()) {
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
                  <div class="flex items-center justify-between mb-5">
                    <h3 class="font-bold text-slate-900" style="font-family: Manrope, Inter, sans-serif">Add a B-race</h3>
                    <button class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" (click)="showAddRaceForm.set(false)">
                      <mat-icon class="!w-4 !h-4">close</mat-icon>
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-4 mb-5">
                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Race name</label>
                      <input type="text" class="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#f07561] focus:ring-2 focus:ring-[#f07561]/10 transition-all" placeholder="e.g. Zandvoort Circuit Run 12K" [(ngModel)]="newRaceName" />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Date</label>
                      <input type="date" class="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#f07561] focus:ring-2 focus:ring-[#f07561]/10 transition-all" [(ngModel)]="newRaceDate" />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Distance (km)</label>
                      <input type="number" class="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#f07561] focus:ring-2 focus:ring-[#f07561]/10 transition-all" placeholder="12" min="0.1" max="500" [(ngModel)]="newRaceDistance" />
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Approach</label>
                      <select class="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#f07561] transition-all bg-white" [(ngModel)]="newRaceApproach">
                        <option value="Relaxed effort">Relaxed effort</option>
                        <option value="Strong and steady">Strong and steady</option>
                        <option value="Go all out">Go all out</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button mat-stroked-button class="!rounded-xl" (click)="showAddRaceForm.set(false)">Cancel</button>
                    <button
                      class="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      [disabled]="!newRaceName || !newRaceDate || !newRaceDistance || savingRace()"
                      (click)="addBRace()"
                    >
                      @if (savingRace()) { <mat-spinner diameter="14" class="inline-block"></mat-spinner> }
                      Add B-race
                    </button>
                  </div>
                </div>
              }

              <!-- B-race detail panel -->
              @if (selectedBRace(); as race) {
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <!-- Panel header -->
                  <div class="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <p class="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">B-race</p>
                        <h3 class="text-lg font-bold" style="font-family: Manrope, Inter, sans-serif">{{ race.name }}</h3>
                        <p class="text-sm text-slate-300 mt-0.5">{{ race.date | date:'EEEE, MMMM d, yyyy' }} &middot; {{ race.distanceKm }} km</p>
                      </div>
                      <div class="text-right flex-shrink-0">
                        @if (weeksUntilBRace(race.date) > 0) {
                          <p class="text-2xl font-extrabold text-[#f07561]">{{ weeksUntilBRace(race.date) }}</p>
                          <p class="text-xs text-slate-400">weeks away</p>
                        } @else {
                          <p class="text-xs text-slate-400 mt-1">Past</p>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="p-6">
                    <!-- Approach -->
                    <div class="mb-6">
                      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Approach</p>
                      @if (editingApproach()) {
                        <div class="flex items-center gap-2">
                          <select class="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#f07561] bg-white" [(ngModel)]="editingApproachValue">
                            <option value="Relaxed effort">Relaxed effort</option>
                            <option value="Strong and steady">Strong and steady</option>
                            <option value="Go all out">Go all out</option>
                          </select>
                          <button class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white" (click)="saveApproach(race)">Save</button>
                          <button class="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600" (click)="editingApproach.set(false)">Cancel</button>
                        </div>
                      } @else {
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3">
                            <span
                              class="px-3 py-1.5 rounded-xl text-sm font-semibold"
                              [class.bg-green-100]="race.approach === 'Relaxed effort'"
                              [class.text-green-700]="race.approach === 'Relaxed effort'"
                              [class.bg-blue-100]="race.approach === 'Strong and steady' || !race.approach"
                              [class.text-blue-700]="race.approach === 'Strong and steady' || !race.approach"
                              [class.bg-rose-100]="race.approach === 'Go all out'"
                              [class.text-rose-700]="race.approach === 'Go all out'"
                            >{{ race.approach || 'Strong and steady' }}</span>
                            <span class="text-xs text-slate-400">{{ trainingDisruption(race.approach || 'Strong and steady') }} disruption</span>
                          </div>
                          <button class="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors" (click)="startEditApproach(race)">
                            <mat-icon class="!w-4 !h-4 text-sm">edit</mat-icon>
                          </button>
                        </div>
                      }
                    </div>

                    <!-- Adjustment insight tabs -->
                    <div class="mb-6">
                      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Adjustment Insight</p>
                      <div class="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [class.bg-white]="selectedAdjustTab() === 'pre'"
                          [class.text-slate-800]="selectedAdjustTab() === 'pre'"
                          [class.shadow-sm]="selectedAdjustTab() === 'pre'"
                          [class.text-slate-500]="selectedAdjustTab() !== 'pre'"
                          (click)="selectedAdjustTab.set('pre')"
                        >Pre-race</button>
                        <button
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [class.bg-white]="selectedAdjustTab() === 'race'"
                          [class.text-slate-800]="selectedAdjustTab() === 'race'"
                          [class.shadow-sm]="selectedAdjustTab() === 'race'"
                          [class.text-slate-500]="selectedAdjustTab() !== 'race'"
                          (click)="selectedAdjustTab.set('race')"
                        >Race week</button>
                        <button
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [class.bg-white]="selectedAdjustTab() === 'post'"
                          [class.text-slate-800]="selectedAdjustTab() === 'post'"
                          [class.shadow-sm]="selectedAdjustTab() === 'post'"
                          [class.text-slate-500]="selectedAdjustTab() !== 'post'"
                          (click)="selectedAdjustTab.set('post')"
                        >Recovery</button>
                      </div>
                      <p class="text-sm text-slate-600 leading-relaxed">{{ adjustmentText(race.approach || 'Strong and steady', selectedAdjustTab()) }}</p>
                    </div>

                    <!-- AI section -->
                    <div class="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-4 mb-4">
                      <div class="flex items-start gap-3">
                        <div class="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                          <mat-icon class="text-white !w-5 !h-5">auto_awesome</mat-icon>
                        </div>
                        <div>
                          <p class="text-sm font-semibold text-violet-900 mb-0.5">AI-powered adjustments</p>
                          <p class="text-xs text-violet-700 leading-relaxed">Analyses the 3 weeks around your B-race and automatically adjusts session types and distances based on your chosen approach — so your training peaks and recovers at the right time.</p>
                        </div>
                      </div>
                    </div>

                    <!-- Diff panel -->
                    @if (sessionDiffs().length > 0) {
                      <div class="rounded-2xl border border-slate-200 overflow-hidden mb-4">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <mat-icon class="text-white !w-3 !h-3 text-xs">check</mat-icon>
                            </span>
                            <span class="text-xs font-semibold text-slate-700">{{ sessionDiffs().length }} session{{ sessionDiffs().length !== 1 ? 's' : '' }} updated</span>
                          </div>
                          <button class="text-slate-400 hover:text-slate-600 transition-colors" (click)="sessionDiffs.set([])">
                            <mat-icon class="!w-4 !h-4">close</mat-icon>
                          </button>
                        </div>
                        <div class="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                          @for (diff of sessionDiffs(); track diff.sessionId) {
                            <div class="px-4 py-3 flex items-start gap-3">
                              <span class="text-xs font-semibold text-slate-400 w-12 flex-shrink-0 mt-0.5">{{ diff.date | date:'MMM d' }}</span>
                              <div class="flex-1 flex flex-wrap items-center gap-2">
                                @if (diff.typeChanged) {
                                  <div class="flex items-center gap-1.5 text-xs">
                                    <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 line-through">{{ sessionConfig(diff.oldType!).label }}</span>
                                    <mat-icon class="!w-3 !h-3 text-slate-400">arrow_forward</mat-icon>
                                    <span class="px-2 py-0.5 rounded-lg" [class]="sessionConfig(diff.newType!).bgColor + ' ' + sessionConfig(diff.newType!).color + ' font-semibold'">{{ sessionConfig(diff.newType!).label }}</span>
                                  </div>
                                }
                                @if (diff.distanceChanged) {
                                  <div class="flex items-center gap-1 text-xs text-slate-500">
                                    <span class="line-through">{{ diff.oldDistance | number:'1.0-1' }}km</span>
                                    <mat-icon class="!w-3 !h-3">arrow_forward</mat-icon>
                                    <span class="font-semibold" [class.text-emerald-600]="diff.newDistance! > diff.oldDistance!" [class.text-rose-600]="diff.newDistance! < diff.oldDistance!">{{ diff.newDistance | number:'1.0-1' }}km</span>
                                  </div>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Actions row -->
                    <div class="flex items-center justify-between">
                      <button
                        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        [disabled]="rescheduling()"
                        (click)="applyAiReschedule(race)"
                      >
                        @if (rescheduling()) {
                          <mat-spinner diameter="14" class="inline-block"></mat-spinner>
                          Adjusting plan…
                        } @else {
                          <mat-icon class="!w-4 !h-4">auto_awesome</mat-icon>
                          Apply AI Adjustments
                        }
                      </button>
                      <button
                        class="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                        (click)="deleteBRace(race)"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 text-sm">delete</mat-icon>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              }
            }
          </div>

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
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);

  plan = signal<TrainingPlanDetail | null>(null);
  loading = signal(true);
  activating = signal(false);

  /** ID of the session currently showing the activity picker */
  readonly pickingSessionId = signal<string | null>(null);

  /** Activities loaded for the picker */
  private readonly _pickerActivities = signal<StravaActivity[]>([]);
  readonly activitiesLoading = signal(false);
  activitySearchQuery = '';

  readonly filteredActivities = computed(() => {
    const q = this.activitySearchQuery.toLowerCase().trim();
    const acts = this._pickerActivities();
    return q ? acts.filter((a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)) : acts;
  });

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
    this.pickingSessionId.set(null);

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

    this._updateSessionOptimistic(session, { skipped: false });

    this.plansService.updateSession(planId, session.id, { skipped: false }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { skipped: session.skipped });
        this.snackBar.open('Failed to undo skip.', 'Close', { duration: 3000 });
      },
    });
  }

  openActivityPicker(session: TrainingSession, event: Event) {
    event.stopPropagation();
    this.activitySearchQuery = '';
    if (this.pickingSessionId() === session.id) {
      this.pickingSessionId.set(null);
      return;
    }
    this.pickingSessionId.set(session.id);
    if (this._pickerActivities().length === 0) {
      this.activitiesLoading.set(true);
      this.stravaService.loadActivities({ perPage: 100 }).subscribe({
        next: (res) => {
          this._pickerActivities.set(res.activities.filter((a) => a.type === 'Run'));
          this.activitiesLoading.set(false);
        },
        error: () => {
          this.activitiesLoading.set(false);
          this.snackBar.open('Failed to load Strava activities.', 'Close', { duration: 3000 });
        },
      });
    }
  }

  linkActivity(session: TrainingSession, activity: StravaActivity) {
    const planId = this.plan()!.id;
    this.pickingSessionId.set(null);
    this.activitySearchQuery = '';

    this._updateSessionOptimistic(session, {
      stravaActivityId: activity.stravaId,
      stravaActivity: { id: activity.id, stravaId: activity.stravaId, name: activity.name, type: activity.type, distance: activity.distance, movingTime: activity.movingTime, startDate: activity.startDate, averageHeartrate: activity.averageHeartrate ?? null },
      completed: true,
      skipped: false,
    });

    this.plansService.updateSession(planId, session.id, { stravaActivityId: activity.stravaId }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { stravaActivityId: session.stravaActivityId, stravaActivity: session.stravaActivity, completed: session.completed, skipped: session.skipped });
        this.snackBar.open('Failed to link activity.', 'Close', { duration: 3000 });
      },
    });
  }

  unlinkActivity(session: TrainingSession, event: Event) {
    event.stopPropagation();
    const planId = this.plan()!.id;

    this._updateSessionOptimistic(session, { stravaActivityId: null, stravaActivity: null, completed: false });

    this.plansService.updateSession(planId, session.id, { stravaActivityId: null }).subscribe({
      error: () => {
        this._updateSessionOptimistic(session, { stravaActivityId: session.stravaActivityId, stravaActivity: session.stravaActivity, completed: session.completed });
        this.snackBar.open('Failed to unlink activity.', 'Close', { duration: 3000 });
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

  // ── B-races ───────────────────────────────────────────────────────────────

  readonly adaptTab = signal<'races'>('races');
  readonly rescheduling = signal(false);
  readonly sessionDiffs = signal<Array<{
    sessionId: string;
    date: string;
    typeChanged: boolean;
    oldType: TrainingSession['sessionType'] | null;
    newType: TrainingSession['sessionType'] | null;
    distanceChanged: boolean;
    oldDistance: number | null;
    newDistance: number | null;
    descriptionChanged: boolean;
    newDescription: string | null;
  }>>([]);
  readonly showAddRaceForm = signal(false);
  readonly selectedBRaceId = signal<string | null>(null);
  readonly savingRace = signal(false);
  readonly editingApproach = signal(false);
  readonly selectedAdjustTab = signal<'pre' | 'race' | 'post'>('pre');

  newRaceName = '';
  newRaceDate = '';
  newRaceDistance = 10;
  newRaceApproach = 'Strong and steady';
  editingApproachValue = '';

  readonly bRaces = computed(() =>
    (this.plan()?.races ?? []).filter((r) => r.type === 'B'),
  );

  readonly selectedBRace = computed(() => {
    const id = this.selectedBRaceId();
    return this.bRaces().find((r) => r.id === id) ?? null;
  });

  openAddRaceForm() {
    this.selectedBRaceId.set(null);
    this.showAddRaceForm.set(true);
  }

  selectBRace(race: Race) {
    this.showAddRaceForm.set(false);
    this.editingApproach.set(false);
    this.selectedBRaceId.set(this.selectedBRaceId() === race.id ? null : race.id);
    this.selectedAdjustTab.set('pre');
    this.sessionDiffs.set([]);
  }

  addBRace() {
    if (!this.newRaceName || !this.newRaceDate || !this.newRaceDistance) return;
    this.savingRace.set(true);
    this.plansService.addRace(this.id, {
      name: this.newRaceName,
      date: this.newRaceDate,
      distanceKm: this.newRaceDistance,
      approach: this.newRaceApproach,
    }).subscribe({
      next: (race) => {
        this.plan.update((p) => (p ? { ...p, races: [...p.races, race] } : null));
        this.showAddRaceForm.set(false);
        this.savingRace.set(false);
        this.selectedBRaceId.set(race.id);
        this.newRaceName = '';
        this.newRaceDate = '';
        this.newRaceDistance = 10;
        this.newRaceApproach = 'Strong and steady';
      },
      error: () => {
        this.savingRace.set(false);
        this.snackBar.open('Failed to add B-race.', 'Close', { duration: 3000 });
      },
    });
  }

  startEditApproach(race: Race) {
    this.editingApproachValue = race.approach || 'Strong and steady';
    this.editingApproach.set(true);
  }

  saveApproach(race: Race) {
    this.plansService.updateRace(this.id, race.id, { approach: this.editingApproachValue }).subscribe({
      next: (updated) => {
        this.plan.update((p) =>
          p ? { ...p, races: p.races.map((r) => (r.id === updated.id ? updated : r)) } : null,
        );
        this.editingApproach.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to update approach.', 'Close', { duration: 3000 });
      },
    });
  }

  deleteBRace(race: Race) {
    this.plansService.deleteRace(this.id, race.id).subscribe({
      next: () => {
        this.plan.update((p) =>
          p ? { ...p, races: p.races.filter((r) => r.id !== race.id) } : null,
        );
        this.selectedBRaceId.set(null);
      },
      error: () => {
        this.snackBar.open('Failed to delete B-race.', 'Close', { duration: 3000 });
      },
    });
  }

  applyAiReschedule(race: Race) {
    this.rescheduling.set(true);
    this.sessionDiffs.set([]);
    const oldSessions = this.plan()?.sessions ?? [];
    this.plansService.rescheduleForBRace(this.id, race.id).subscribe({
      next: (updatedPlan) => {
        // Compute diffs
        const oldMap = new Map(oldSessions.map((s) => [s.id, s]));
        const diffs = updatedPlan.sessions.flatMap((s) => {
          const old = oldMap.get(s.id);
          if (!old) return [];
          const typeChanged = old.sessionType !== s.sessionType;
          const distanceChanged = old.plannedDistanceKm !== s.plannedDistanceKm;
          const descriptionChanged = old.description !== s.description;
          if (!typeChanged && !distanceChanged && !descriptionChanged) return [];
          return [{
            sessionId: s.id,
            date: s.date,
            typeChanged,
            oldType: typeChanged ? old.sessionType : null,
            newType: typeChanged ? s.sessionType : null,
            distanceChanged,
            oldDistance: distanceChanged ? old.plannedDistanceKm : null,
            newDistance: distanceChanged ? s.plannedDistanceKm : null,
            descriptionChanged,
            newDescription: descriptionChanged ? s.description : null,
          }];
        });
        this.plan.set(updatedPlan);
        this._sessionsByWeek.set(this.plansService.groupSessionsByWeek(updatedPlan.sessions));
        this.sessionDiffs.set(diffs);
        this.rescheduling.set(false);
        this.snackBar.open(`Plan adjusted — ${diffs.length} session${diffs.length !== 1 ? 's' : ''} changed.`, 'Close', { duration: 4000 });
      },
      error: (err: any) => {
        this.rescheduling.set(false);
        const msg = err?.error?.message || 'AI rescheduling failed. Check your API key.';
        this.snackBar.open(msg, 'Close', { duration: 6000 });
      },
    });
  }

  weekEndDate(startDate: string): Date {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 6);
    return d;
  }

  weeksUntilBRace(dateStr: string): number {
    const today = new Date();
    const raceDate = new Date(dateStr);
    return Math.ceil((raceDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }

  trainingDisruption(approach: string): string {
    return approach === 'Go all out' ? 'Medium' : 'Low';
  }

  adjustmentText(approach: string, period: 'pre' | 'race' | 'post'): string {
    if (period === 'pre') {
      if (approach === 'Relaxed effort') return 'No changes to your plan this week. Treat the B-race as a hard training run.';
      if (approach === 'Go all out') return 'Volume is reduced by 30% and hard sessions are replaced with easy runs to keep you fresh.';
      return 'Your volume is slightly reduced the week before to keep you fresh for race day.';
    }
    if (period === 'race') {
      if (approach === 'Relaxed effort') return 'Run it at a comfortable, controlled effort — treat it like a tempo run.';
      if (approach === 'Go all out') return 'Race day! Give it everything — run it with the same intensity as your A-race.';
      return 'Race day! Run strong and steady. Give a solid effort while keeping something in reserve for your main goal.';
    }
    if (approach === 'Relaxed effort') return 'Normal training resumes immediately. No extra recovery needed.';
    if (approach === 'Go all out') return 'A full recovery week follows with volume reduced by 40% to help you bounce back.';
    return 'A lighter recovery week with 20% reduced volume to ensure you bounce back well.';
  }
}
