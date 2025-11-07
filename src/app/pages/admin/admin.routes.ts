import { Routes } from '@angular/router';
import { StarterComponent } from '../starter/starter.component';

export const AdminRoutes: Routes = [
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
  {
    path: 'famille',
    loadComponent: () => import('./famille/admin-famille/admin-famille.component').then((m) => m.AdminFamilleComponent),
  },
  {
    path: 'famille/:id',
    loadComponent: () => import('./famille/admin-famille-detail/admin-famille-detail.component').then((m) => m.AdminFamilleDetailComponent),
  },
  {
    path: 'familles',
    loadComponent: () => import('./famille/admin-famille-list/admin-famille-list.component').then((m) => m.AdminFamilleListComponent),
  },
  {
    path: 'ui-components',
    loadChildren: () =>
      import('./ui-components/ui-components.routes').then(
        (m) => m.UiComponentsRoutes
      ),
  },
];
