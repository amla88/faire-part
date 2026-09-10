import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { AuthGuard, guestPublicHomeGuard, landingRedirectGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  {
    path: 'quick-login',
    loadComponent: () =>
      import('./pages/authentication/quick-login-legacy.component').then((m) => m.QuickLoginLegacyComponent),
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
      {
        path: '',
        canActivateChild: [AuthGuard, guestPublicHomeGuard],
        children: [
          {
            path: '',
            // Redirige immédiatement vers /dashboard (évite un écran blanc)
            canMatch: [landingRedirectGuard],
            loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent),
            pathMatch: 'full',
          },
          {
            path: 'decompte',
            redirectTo: '/dashboard',
            pathMatch: 'full',
          },
          {
            path: 'person',
            redirectTo: '/dashboard',
            pathMatch: 'full',
          },
          {
            path: '',
            component: FullComponent,
            children: [
              {
                path: 'dashboard',
                loadComponent: () =>
                  import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
              },
              { path: 'rsvp', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'anecdotes', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'idees', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'musiques', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'jeu', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'anniversaire-40', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'profile', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'avatar', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'photos/upload', redirectTo: 'dashboard', pathMatch: 'full' },
              { path: 'photos/album', redirectTo: 'dashboard', pathMatch: 'full' },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'admin',
    component: FullComponent,
    canMatch: [adminGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./pages/admin/admin.routes').then(
            (m) => m.AdminRoutes
          ),
      }
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
