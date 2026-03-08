import { Routes } from '@angular/router';

export const PLANS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./plans-list/plans-list.component').then(
        (m) => m.PlansListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./create-plan/create-plan.component').then(
        (m) => m.CreatePlanComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./plan-detail/plan-detail.component').then(
        (m) => m.PlanDetailComponent,
      ),
  },
];
