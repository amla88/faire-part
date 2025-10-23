import { Routes } from '@angular/router';
import { FullLayoutComponent } from './layouts/full-layout/full-layout.component';
import { BlankLayoutComponent } from './layouts/blank-layout/blank-layout.component';
import { guestAuthGuard, publicGuard, adminAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: BlankLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: '/login',
        pathMatch: 'full'
      },
      {
        path: 'login',
        canActivate: [publicGuard],
        loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'admin-login',
        loadComponent: () => import('./pages/admin-login/admin-login.component').then(m => m.AdminLoginComponent)
      },
    ]
  },
  {
    path: '',
    component: FullLayoutComponent,
    canActivate: [guestAuthGuard],
    children: [
      {
        path: 'person',
        loadComponent: () => import('./pages/person-switcher/person-switcher.component').then(m => m.PersonSwitcherComponent)
      },
      {
        path: 'avatar',
        loadComponent: () => import('./pages/avatar/avatar.component').then(m => m.AvatarComponent)
      },
      {
        path: 'game',
        loadComponent: () => import('./game/game.component').then(m => m.GameComponent)
      },
      {
        path: 'rsvp',
        loadComponent: () => import('./pages/rsvp/rsvp.component').then(m => m.RsvpComponent)
      },
      {
        path: 'music',
        loadComponent: () => import('./pages/music/music.component').then(m => m.MusicComponent)
      },
      {
        path: 'photos',
        loadComponent: () => import('./pages/photos/photos.component').then(m => m.PhotosComponent)
      },
      {
        path: 'photos/upload',
        loadComponent: () => import('./pages/photos-upload/photos-upload.component').then(m => m.PhotosUploadComponent)
      },
      {
        path: 'admin',
        canActivate: [adminAuthGuard],
        loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'admin/assets',
        canActivate: [adminAuthGuard],
        loadComponent: () => import('./pages/admin-assets/admin-assets.component').then(m => m.AdminAssetsComponent)
      },
      {
        path: 'admin/music',
        canActivate: [adminAuthGuard],
        loadComponent: () => import('./pages/admin-music/admin-music.component').then(m => m.AdminMusicComponent)
      },
      {
        path: 'admin/photos',
        canActivate: [adminAuthGuard],
        loadComponent: () => import('./pages/admin-photos/admin-photos.component').then(m => m.AdminPhotosComponent)
      },
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
