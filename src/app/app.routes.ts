import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { FullAdminComponent } from './layouts/full/full-admin.component';
import { AuthGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    canActivateChild: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
      },
      {
        path: 'ui-components',
        loadChildren: () =>
          import('./pages/ui-components/ui-components.routes').then(
            (m) => m.UiComponentsRoutes
          ),
      },
      {
        path: 'extra',
        loadChildren: () =>
          import('./pages/extra/extra.routes').then((m) => m.ExtraRoutes),
      },
      {
        path: 'avatar',
        loadComponent: () => import('./pages/avatar/avatar-editor.component').then((m) => m.AvatarEditorComponent),
        canActivate: [AuthGuard],
      },
      {
        path: 'photos/upload',
        loadComponent: () => import('./pages/photos/upload/photo-upload.component').then((m) => m.PhotoUploadComponent),
        canActivate: [AuthGuard],
      },
      {
        path: 'photos/album',
        loadComponent: () => import('./pages/photos/album/photo-album.component').then((m) => m.PhotoAlbumComponent),
        canActivate: [AuthGuard],
      },
    ],
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
        path: 'admin-login',
        loadComponent: () => import('./pages/authentication/admin-login/admin-login.component').then((m) => m.AdminLoginComponent),
      },
      {
        path: 'person',
        loadComponent: () => import('./pages/person/person.component').then((m) => m.PersonComponent),
        canActivate: [AuthGuard],
      },
    ],
  },
  {
    path: 'admin',
    component: FullAdminComponent,
    canMatch: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'famille',
        loadComponent: () => import('./pages/admin/famille/admin-famille.component').then((m) => m.AdminFamilleComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
