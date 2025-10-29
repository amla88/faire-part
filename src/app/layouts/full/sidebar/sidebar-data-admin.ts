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

  { navCap: 'Ui Components' },
  { displayName: 'Badge', iconName: 'archive', route: '/admin/ui-components/badge' },
  { displayName: 'Chips', iconName: 'info-circle', route: '/admin/ui-components/chips' },
  { displayName: 'Lists', iconName: 'list-details', route: '/admin/ui-components/lists' },
  { displayName: 'Menu', iconName: 'file-text', route: '/admin/ui-components/menu' },
  { displayName: 'Tooltips', iconName: 'file-text-ai', route: '/admin/ui-components/tooltips' },
  { displayName: 'Forms', iconName: 'clipboard-text', route: '/admin/ui-components/forms' },
  { displayName: 'Tables', iconName: 'table', route: '/admin/ui-components/tables' },
];
