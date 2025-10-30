import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  { navCap: 'Home' },
  {
    displayName: 'Dashboard',
    iconName: 'layout-grid-add',
    route: '/dashboard',
  },

  { navCap: 'Pages' },
  { displayName: 'Avatar', iconName: 'user', route: '/avatar' },
  { displayName: 'Upload', iconName: 'photo-up', route: '/photos/upload' },
  { displayName: 'Album', iconName: 'library-photo', route: '/photos/album' },

  { navCap: 'Auth' },
  {
    displayName: 'Changer de personne',
    iconName: 'users',
    route: '/person',
  },
];
