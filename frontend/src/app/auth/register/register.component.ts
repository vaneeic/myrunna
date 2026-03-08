import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <mat-card class="w-full max-w-md p-8">
        <mat-card-header class="mb-6 justify-center">
          <mat-card-title class="text-2xl font-bold text-primary-700">
            Create your account
          </mat-card-title>
          <mat-card-subtitle>Start training smarter</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Display Name</mat-label>
              <input matInput formControlName="displayName" autocomplete="name" />
              <mat-error>Display name must be at least 2 characters</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-error>Valid email is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" />
              <mat-hint>At least 8 characters</mat-hint>
              <mat-error>Password must be at least 8 characters</mat-error>
            </mat-form-field>

            @if (error()) {
              <p class="text-red-600 text-sm">{{ error() }}</p>
            }

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="w-full py-3 mt-2"
              [disabled]="loading() || form.invalid"
            >
              @if (loading()) {
                <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
              }
              Create account
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="justify-center">
          <p class="text-sm text-gray-600">
            Already have an account?
            <a routerLink="/auth/login" class="text-primary-600 font-medium hover:underline">Sign in</a>
          </p>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class RegisterComponent {
  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const { email, password, displayName } = this.form.value;
    this.authService.register(email!, password!, displayName!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.message || 'Registration failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
