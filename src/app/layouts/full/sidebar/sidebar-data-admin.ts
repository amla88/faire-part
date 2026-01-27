import { NavItem } from './nav-item/nav-item';

export const navItemsAdmin: NavItem[] = [
  { navCap: 'Administration' },
  {
    displayName: 'Tableau de bord',
    iconName: 'layout-grid-add',
    route: '/admin',
  },
  { navCap: 'Gestion' },
  { displayName: 'Liste familles', iconName: 'users', route: '/admin/familles' },
  { displayName: 'Ajouter famille', iconName: 'user-plus', route: '/admin/famille' },
];
