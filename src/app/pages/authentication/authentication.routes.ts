import { Routes } from '@angular/router';

import { AppSideLoginComponent } from './side-login/side-login.component';
import { AppSideRegisterComponent } from './side-register/side-register.component';
import { QuickLoginGuard } from './quick-login/quick-login.guard';

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
        path: 'register',
        component: AppSideRegisterComponent,
      },
    ],
  },
];
