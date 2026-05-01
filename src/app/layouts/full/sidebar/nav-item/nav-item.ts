export interface NavItem {
    displayName?: string;
    iconName?: string;
    navCap?: string;
    route?: string;
    /** Si vrai : entrée masquée tant que la personne sélectionnée n’a pas `invite_anniversaire`. */
    requiresAnniversaireInvite?: boolean;
    children?: NavItem[];
    chip?: boolean;
    chipContent?: string;
    chipClass?: string;
    external?: boolean;
}