import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';
import { adminGuard } from '../services/admin.guard';

export const PagesRoutes: Routes = [
  {
    path: '',
    component: StarterComponent,
    data: {
      title: 'Starter Page',
      urls: [
        { title: 'Dashboard', url: '/dashboards/dashboard1' },
        { title: 'Starter Page' },
      ],
    },
  },
  // Note: admin routes are exposed at top-level '/admin' (see app.routes.ts)
];
