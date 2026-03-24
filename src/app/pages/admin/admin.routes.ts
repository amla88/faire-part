import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';

export const AdminRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: AdminDashboardComponent
  },
  {
    path: 'famille',
    loadComponent: () => import('./famille/admin-famille/admin-famille.component').then((m) => m.AdminFamilleComponent),
  },
  {
    path: 'famille/:id',
    loadComponent: () => import('./famille/admin-famille-detail/admin-famille-detail.component').then((m) => m.AdminFamilleDetailComponent),
  },
  {
    path: 'familles',
    loadComponent: () => import('./famille/admin-famille-list/admin-famille-list.component').then((m) => m.AdminFamilleListComponent),
  },
  {
    path: 'export-invitations',
    loadComponent: () => import('./export-invitations/export-invitations.component').then((m) => m.ExportInvitationsComponent),
  },
  {
    path: 'ui-components',
    loadChildren: () =>
      import('./ui-components/ui-components.routes').then(
        (m) => m.UiComponentsRoutes
      ),
  },
];
