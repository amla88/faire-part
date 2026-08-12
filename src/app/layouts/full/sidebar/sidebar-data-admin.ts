import { NavItem } from './nav-item/nav-item';

export const navItemsAdmin: NavItem[] = [
  { navCap: 'Administration' },
  {
    displayName: 'Tableau de bord',
    iconName: 'layout-grid-add',
    route: '/admin',
  },
  { navCap: 'Gestion' },
  { displayName: 'Suivi présences & jeu', iconName: 'clipboard-list', route: '/admin/suivi-presences-jeux' },
  { displayName: 'Liste familles', iconName: 'users', route: '/admin/familles' },
  { displayName: 'Ajouter famille', iconName: 'user-plus', route: '/admin/famille' },
  { displayName: 'Plan de table', iconName: 'picnic-table', route: '/admin/plan-de-table' },
  { displayName: 'Musiques invités', iconName: 'music', route: '/admin/musiques' },
  { displayName: 'Avatars invités', iconName: 'user-circle', route: '/admin/avatars' },
  { displayName: 'Boîte à idées', iconName: 'bulb', route: '/admin/boite-idees' },
  { displayName: 'Anecdotes', iconName: 'quotes', route: '/admin/anecdotes' },
  { displayName: 'Albums photo', iconName: 'photo_library', route: '/admin/photo-albums' },
];
