import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatRippleModule,
  ],
  template: `
    @if (authService.isLoggedIn()) {
      @if (isMobile()) {
        <!-- ── Mobile layout: full screen + bottom nav ── -->
        <div class="flex flex-col min-h-screen min-h-dvh">
          <main class="flex-1 overflow-y-auto pb-16">
            <router-outlet></router-outlet>
          </main>

          <!-- Bottom nav bar -->
          <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-center safe-area-bottom" style="padding-bottom: env(safe-area-inset-bottom)">
            @for (item of navItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive
                #rla="routerLinkActive"
                class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors no-underline"
                [style.color]="rla.isActive ? '#e91e8c' : '#94a3b8'"
              >
                <mat-icon class="!w-5 !h-5 text-xl leading-none">{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        </div>

      } @else {
        <!-- ── Desktop layout: slim icon sidebar ── -->
        <div class="flex min-h-screen">

          <!-- Slim sidebar -->
          <aside class="w-16 flex-shrink-0 flex flex-col items-center py-4 gap-1 border-r border-gray-200 bg-white sticky top-0 h-screen overflow-hidden">
            <!-- Logo -->
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3 flex-shrink-0" style="background: linear-gradient(135deg, #1a0a2e, #e91e8c)">
              <mat-icon class="text-white !w-5 !h-5 text-lg">directions_run</mat-icon>
            </div>

            @for (item of navItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive
                #rla="routerLinkActive"
                matRipple
                [matTooltip]="item.label"
                matTooltipPosition="right"
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all no-underline"
                [style.background-color]="rla.isActive ? '#fce4ec' : 'transparent'"
                [style.color]="rla.isActive ? '#e91e8c' : '#94a3b8'"
              >
                <mat-icon class="!w-5 !h-5 text-xl">{{ item.icon }}</mat-icon>
              </a>
            }

            <!-- Spacer -->
            <div class="flex-1"></div>

            <!-- Logout -->
            <button
              matRipple
              matTooltip="Sign out"
              matTooltipPosition="right"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all border-0 bg-transparent cursor-pointer"
              (click)="authService.logout()"
            >
              <mat-icon class="!w-5 !h-5 text-xl">logout</mat-icon>
            </button>
          </aside>

          <!-- Content -->
          <main class="flex-1 min-w-0 overflow-y-auto">
            <router-outlet></router-outlet>
          </main>
        </div>
      }
    } @else {
      <!-- Auth pages — no nav -->
      <router-outlet></router-outlet>
    }
  `,
  styles: [`
    :host { display: block; }
    a { text-decoration: none; }
  `]
})
export class AppComponent {
  readonly authService = inject(AuthService);

  private bp = inject(BreakpointObserver);
  isMobile = toSignal(
    this.bp.observe('(max-width: 767px)').pipe(map(r => r.matches)),
    { initialValue: false }
  );

  navItems = [
    { route: '/dashboard', icon: 'dashboard',      label: 'Home'      },
    { route: '/plans',     icon: 'directions_run', label: 'Plans'     },
    { route: '/strava',    icon: 'fitness_center', label: 'Activities'},
    { route: '/settings',  icon: 'settings',       label: 'Settings'  },
  ];
}
