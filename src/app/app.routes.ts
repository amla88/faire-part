import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-auth.guard';
import { guestGuard } from './guards/guest.guard';
import { GuestLayoutComponent } from './layouts/guest-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'admin-login', loadComponent: () => import('./pages/admin-login/admin-login.component').then(m => m.AdminLoginComponent) },

  // Routes guest avec layout
  {
    path: '',
    component: GuestLayoutComponent,
    canActivate: [guestGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard-guest/dashboard-guest.component').then(m => m.DashboardGuestComponent) },
      { path: 'game', loadComponent: () => import('./game/game.component').then(m => m.GameComponent) },
      { path: 'person', loadComponent: () => import('./pages/person-switcher/person-switcher.component').then(m => m.PersonSwitcherComponent) },
      { path: 'music', loadComponent: () => import('./pages/music/music.component').then(m => m.MusicComponent) },
      { path: 'avatar', loadComponent: () => import('./pages/avatar-editor/avatar-editor.component').then(m => m.AvatarEditorComponent) },
      { path: 'photos/upload', loadComponent: () => import('./pages/photos-upload/photos-upload.component').then(m => m.PhotosUploadComponent) },
      { path: 'photos', loadComponent: () => import('./pages/photos-gallery/photos-gallery.component').then(m => m.PhotosGalleryComponent) },
      { path: 'rsvp', loadComponent: () => import('./pages/rsvp/rsvp.component').then(m => m.RsvpComponent) }
    ]
  },

  // Routes admin avec layout
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent) },
      { path: 'assets', loadComponent: () => import('./pages/admin-avatar-assets/admin-avatar-assets.component').then(m => m.AdminAvatarAssetsComponent) },
      { path: 'music', loadComponent: () => import('./pages/admin-music/admin-music.component').then(m => m.AdminMusicComponent) },
      { path: 'photos', loadComponent: () => import('./pages/admin-photos/admin-photos.component').then(m => m.AdminPhotosComponent) }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
