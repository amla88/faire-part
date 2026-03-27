import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
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
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'rsvp',
        loadComponent: () =>
          import('./pages/rsvp/rsvp.component').then((m) => m.RsvpComponent),
      },
      {
        path: 'anecdotes',
        loadComponent: () =>
          import('./pages/anecdotes/anecdotes.component').then((m) => m.AnecdotesComponent),
      },
      {
        path: 'idees',
        loadComponent: () =>
          import('./pages/boite-idees/boite-idees.component').then((m) => m.BoiteIdeesComponent),
      },
      {
        path: 'musiques',
        loadComponent: () =>
          import('./pages/musiques/musiques.component').then((m) => m.MusiquesComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
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
        path: 'person',
        loadComponent: () => import('./pages/person/person.component').then((m) => m.PersonComponent),
        canActivate: [AuthGuard],
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
    redirectTo: '/',
  },
];
