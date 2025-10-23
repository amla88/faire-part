import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadComponent: () => import('./pages/login.component').then(m => m.LoginComponent) },
  { path: 'admin-login', loadComponent: () => import('./pages/admin-login.component').then(m => m.AdminLoginComponent) },
  { path: 'rsvp', canActivate: [guestGuard], loadComponent: () => import('./pages/rsvp.component').then(m => m.RsvpComponent) },
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin.component').then(m => m.AdminComponent) },
  { path: 'admin/assets', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-avatar-assets.component').then(m => m.AdminAvatarAssetsComponent) },
  { path: 'music', canActivate: [guestGuard], loadComponent: () => import('./pages/music.component').then(m => m.MusicComponent) },
  { path: 'avatar', canActivate: [guestGuard], loadComponent: () => import('./pages/avatar-editor.component').then(m => m.AvatarEditorComponent) },
  { path: 'game', canActivate: [guestGuard], loadComponent: () => import('./game/game.component').then(m => m.GameComponent) },
  { path: 'person', canActivate: [guestGuard], loadComponent: () => import('./pages/person-switcher.component').then(m => m.PersonSwitcherComponent) },
  { path: 'admin/music', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-music.component').then(m => m.AdminMusicComponent) },
  { path: 'photos/upload', canActivate: [guestGuard], loadComponent: () => import('./pages/photos-upload.component').then(m => m.PhotosUploadComponent) },
  { path: 'photos', canActivate: [guestGuard], loadComponent: () => import('./pages/photos-gallery.component').then(m => m.PhotosGalleryComponent) },
  { path: 'admin/photos', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-photos.component').then(m => m.AdminPhotosComponent) },
  { path: '**', redirectTo: 'login' }
];
