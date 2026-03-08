import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../shared/services/api.service';

@Component({
  selector: 'app-strava',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
  ],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Strava Activities</h1>
        <button mat-stroked-button (click)="syncActivities()" [disabled]="syncing()">
          <mat-icon>sync</mat-icon>
          {{ syncing() ? 'Syncing...' : 'Sync Activities' }}
        </button>
      </div>

      @if (status()?.connected === false) {
        <mat-card class="p-6 text-center mb-6">
          <p class="text-gray-600 mb-4">Connect your Strava account to see your activities here.</p>
          <a mat-raised-button color="accent" href="/settings">Connect Strava</a>
        </mat-card>
      }

      <p class="text-gray-500">Activities will be displayed here once you sync your Strava account.</p>
    </div>
  `,
})
export class StravaComponent implements OnInit {
  status = signal<any>(null);
  syncing = signal(false);

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<any>('/strava/status').subscribe({
      next: (s) => this.status.set(s),
      error: () => {},
    });
  }

  syncActivities() {
    this.syncing.set(true);
    this.api.post<any>('/strava/sync', {}).subscribe({
      next: () => this.syncing.set(false),
      error: () => this.syncing.set(false),
    });
  }
}
