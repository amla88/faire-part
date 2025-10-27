import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { AuthGuard } from './services/auth.guard';

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
        path: 'person',
        loadComponent: () => import('./pages/person/person.component').then((m) => m.PersonComponent),
        canActivate: [AuthGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
