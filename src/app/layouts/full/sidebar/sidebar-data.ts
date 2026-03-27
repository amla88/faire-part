import { NavItem } from './nav-item/nav-item';

/** Libellés : ton « salon » Bridgerton + clin d’œil geek (carte, chroniques, quêtes, personnage). */
export const navItems: NavItem[] = [
  { navCap: 'Entrée' },
  {
    displayName: 'Les prémices',
    iconName: 'layout-grid-add',
    route: '/dashboard',
  },

  { navCap: 'Les salons' },
  { displayName: 'Votre effigie', iconName: 'user', route: '/avatar' },
  { displayName: 'Déposer un cliché', iconName: 'photo-up', route: '/photos/upload' },
  { displayName: 'Galerie des souvenirs', iconName: 'library-photo', route: '/photos/album' },
  { displayName: 'Chroniques du salon', iconName: 'quotes', route: '/anecdotes' },
  { displayName: 'Air du bal', iconName: 'library_music', route: '/musiques' },
  { displayName: 'Quêtes annexes', iconName: 'bulb', route: '/idees' },

  { navCap: 'Identité' },
  {
    displayName: 'Changer de personnage',
    iconName: 'users',
    route: '/person',
  },
];
