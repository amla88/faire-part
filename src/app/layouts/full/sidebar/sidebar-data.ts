import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  { navCap: 'Home' },
  {
    displayName: 'Dashboard',
    iconName: 'layout-grid-add',
    route: '/dashboard',
  },

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

  { navCap: 'Pages' },
  { displayName: 'Icons', iconName: 'mood-smile', route: '/extra/icons' },
  { displayName: 'Avatar', iconName: 'user', route: '/avatar' },
  { displayName: 'Sample Page', iconName: 'brand-dribbble', route: '/extra/sample-page' },

  { navCap: 'Auth' },
  {
    displayName: 'Login',
    iconName: 'login',
    route: '/authentication/login',
  },
  {
    displayName: 'person',
    iconName: 'Changer de personne',
    route: '/person',
  },
];
