import { Routes } from '@angular/router';

import { AppSideLoginComponent } from './side-login/side-login.component';
import { QuickLoginGuard } from './quick-login/quick-login.guard';
import { AdminLoginComponent } from './admin-login/admin-login.component';

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'login',
        component: AppSideLoginComponent,
      },
      {
        path: 'quick/:code',
        component: AppSideLoginComponent,
        canActivate: [QuickLoginGuard],
      },
      {
        path: 'admin-login',
        component: AdminLoginComponent,
      },
      // registration route removed
    ],
  },
];
