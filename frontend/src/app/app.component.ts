import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
  ],
  template: `
    @if (authService.isLoggedIn()) {
      <mat-sidenav-container class="min-h-screen">
        <!-- Sidebar -->
        <mat-sidenav mode="side" opened class="w-56 bg-white border-r border-gray-200">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-bold text-primary-700">MyRunna</h2>
          </div>
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="bg-primary-50 text-primary-700">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/plans" routerLinkActive="bg-primary-50 text-primary-700">
              <mat-icon matListItemIcon>directions_run</mat-icon>
              <span matListItemTitle>Training Plans</span>
            </a>
            <a mat-list-item routerLink="/strava" routerLinkActive="bg-primary-50 text-primary-700">
              <mat-icon matListItemIcon>fitness_center</mat-icon>
              <span matListItemTitle>Activities</span>
            </a>
            <a mat-list-item routerLink="/settings" routerLinkActive="bg-primary-50 text-primary-700">
              <mat-icon matListItemIcon>settings</mat-icon>
              <span matListItemTitle>Settings</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>

        <!-- Main content -->
        <mat-sidenav-content>
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>
    } @else {
      <!-- Auth pages — no sidebar -->
      <router-outlet></router-outlet>
    }
  `,
})
export class AppComponent {
  constructor(readonly authService: AuthService) {}
}
