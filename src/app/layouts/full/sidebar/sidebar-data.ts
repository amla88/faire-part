import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  { navCap: 'Home' },
  {
    displayName: 'Dashboard',
    iconName: 'layout-grid-add',
    route: '/dashboard',
  },

  { navCap: 'Pages' },
  { displayName: 'Icons', iconName: 'mood-smile', route: '/extra/icons' },
  { displayName: 'Avatar', iconName: 'user', route: '/avatar' },
  { displayName: 'Upload', iconName: 'photo-up', route: '/photos/upload' },
  { displayName: 'Album', iconName: 'library-photo', route: '/photos/album' },
  { displayName: 'Sample Page', iconName: 'brand-dribbble', route: '/extra/sample-page' },

  { navCap: 'Auth' },
  {
    displayName: 'Login',
    iconName: 'login',
    route: '/authentication/login',
  },
  {
    displayName: 'Changer de personne',
    iconName: 'users',
    route: '/person',
  },
  { navCap: 'Admin' },
  {
    displayName: 'Ajouter Famille',
    iconName: 'family',
    route: '/admin/famille',
  },
];
