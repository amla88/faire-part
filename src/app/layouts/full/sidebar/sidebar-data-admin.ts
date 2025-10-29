import { NavItem } from './nav-item/nav-item';

export const navItemsAdmin: NavItem[] = [
  { navCap: 'Administration' },
  {
    displayName: 'Tableau de bord',
    iconName: 'layout-grid-add',
    route: '/admin',
  },
  { navCap: 'Gestion' },
  { displayName: 'Invités / Familles', iconName: 'users', route: '/admin/famille' },
  { displayName: 'Assets avatar', iconName: 'photo', route: '/admin/assets' },
  { displayName: 'Photos (modération)', iconName: 'photo-up', route: '/admin/photos' },
  { displayName: 'Musiques (modération)', iconName: 'music', route: '/admin/music' },
  { displayName: 'Statistiques', iconName: 'chart-pie', route: '/admin/stats' },
  { navCap: 'Utilitaires' },
  { displayName: 'Paramètres', iconName: 'settings', route: '/admin/settings' },


  { navCap: 'Apps' },

  { navCap: 'Ui Components' },
  { displayName: 'Badge', iconName: 'archive', route: '/ui-components/badge' },
  { displayName: 'Chips', iconName: 'info-circle', route: '/ui-components/chips' },
  { displayName: 'Lists', iconName: 'list-details', route: '/ui-components/lists' },
  { displayName: 'Menu', iconName: 'file-text', route: '/ui-components/menu' },
  { displayName: 'Tooltips', iconName: 'file-text-ai', route: '/ui-components/tooltips' },
  { displayName: 'Forms', iconName: 'clipboard-text', route: '/ui-components/forms' },
  { displayName: 'Tables', iconName: 'table', route: '/ui-components/tables' },
  { displayName: 'Tabs', iconName: 'border-all', route: '/ui-components/tabs' },
  { displayName: 'Toolbar', iconName: 'tools-kitchen', route: '/ui-components/toolbar' },
];
