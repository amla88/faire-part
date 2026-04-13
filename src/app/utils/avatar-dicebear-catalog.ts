/** Listes des options DiceBear « avataaars » — partagées site (éditeur) et jeu Phaser. */

export type AvatarOptionItem = { value: string; label: string };

export const AVATAR_TOP_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'noHair', label: 'Chauve' },
  { value: 'bigHair', label: 'Cheveux volumineux' },
  { value: 'bob', label: 'Carré' },
  { value: 'bun', label: 'Chignon' },
  { value: 'curly', label: 'Cheveux bouclés' },
  { value: 'curvy', label: 'Cheveux ondulés' },
  { value: 'dreads', label: 'Dreadlocks' },
  { value: 'dreads01', label: 'Dreadlocks 1' },
  { value: 'dreads02', label: 'Dreadlocks 2' },
  { value: 'frida', label: 'Frida' },
  { value: 'frizzle', label: 'Crépus' },
  { value: 'fro', label: 'Coupe afro' },
  { value: 'froBand', label: 'Afro avec bandeau' },
  { value: 'hat', label: 'Chapeau' },
  { value: 'hijab', label: 'Hijab' },
  { value: 'longButNotTooLong', label: 'Cheveux mi-longs' },
  { value: 'miaWallace', label: 'Mia Wallace' },
  { value: 'shaggy', label: 'Dégradé' },
  { value: 'shaggyMullet', label: 'Mulet' },
  { value: 'shavedSides', label: 'Côtés rasés' },
  { value: 'shortCurly', label: 'Bouclés courts' },
  { value: 'shortFlat', label: 'Plats courts' },
  { value: 'shortRound', label: 'Arrondis courts' },
  { value: 'shortWaved', label: 'Ondulés courts' },
  { value: 'sides', label: 'Côtés' },
  { value: 'straight01', label: 'Lisses 1' },
  { value: 'straight02', label: 'Lisses 2' },
  { value: 'straightAndStrand', label: 'Lisses avec mèche' },
  { value: 'theCaesar', label: 'César' },
  { value: 'theCaesarAndSidePart', label: 'César avec raie' },
  { value: 'turban', label: 'Turban' },
  { value: 'winterHat1', label: 'Bonnet 1' },
  { value: 'winterHat02', label: 'Bonnet 2' },
  { value: 'winterHat03', label: 'Bonnet 3' },
  { value: 'winterHat04', label: 'Bonnet 4' },
];

export const AVATAR_ACCESSORIES_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'eyepatch', label: 'Cache-œil' },
  { value: 'kurt', label: 'Lunettes Kurt' },
  { value: 'prescription01', label: 'Lunettes de vue 1' },
  { value: 'prescription02', label: 'Lunettes de vue 2' },
  { value: 'round', label: 'Lunettes rondes' },
  { value: 'sunglasses', label: 'Lunettes de soleil' },
  { value: 'wayfarers', label: 'Wayfarers' },
];

export const AVATAR_HAIR_COLOR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: '2c1b18', label: 'Noir' },
  { value: '4a312c', label: 'Brun' },
  { value: '724133', label: 'Châtain' },
  { value: '6a4e35', label: 'Brun clair' },
  { value: 'a55728', label: 'Roux' },
  { value: 'b58143', label: 'Blond foncé' },
  { value: 'c93305', label: 'Roux vif' },
  { value: 'd6b370', label: 'Blond' },
  { value: 'e8e1e1', label: 'Gris' },
  { value: 'ecdcbf', label: 'Blond platine' },
  { value: 'f59797', label: 'Rose' },
  { value: 'ff0000', label: 'Rouge' },
  { value: '0000ff', label: 'Bleu' },
  { value: '00ff00', label: 'Vert' },
  { value: 'ff00ff', label: 'Magenta' },
  { value: '800080', label: 'Violet' },
  { value: 'ffffff', label: 'Blanc' },
];

export const AVATAR_FACIAL_HAIR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'beardLight', label: 'Barbe légère' },
  { value: 'beardMajestic', label: 'Barbe majestueuse' },
  { value: 'beardMedium', label: 'Barbe moyenne' },
  { value: 'moustacheFancy', label: 'Moustache chic' },
  { value: 'moustacheMagnum', label: 'Moustache Magnum' },
];

export const AVATAR_CLOTHING_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'blazerAndShirt', label: 'Blazer et chemise' },
  { value: 'blazerAndSweater', label: 'Blazer et pull' },
  { value: 'collarAndSweater', label: 'Col et pull' },
  { value: 'graphicShirt', label: 'T-shirt à motif' },
  { value: 'hoodie', label: 'Sweat à capuche' },
  { value: 'overall', label: 'Salopette' },
  { value: 'shirtCrewNeck', label: 'T-shirt col rond' },
  { value: 'shirtScoopNeck', label: 'T-shirt col large' },
  { value: 'shirtVNeck', label: 'T-shirt col V' },
];

export const AVATAR_CLOTHING_GRAPHIC_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'bat', label: 'Chauve-souris' },
  { value: 'bear', label: 'Ours' },
  { value: 'cumbia', label: 'Cumbia' },
  { value: 'deer', label: 'Cerf' },
  { value: 'diamond', label: 'Diamant' },
  { value: 'hola', label: 'Hola' },
  { value: 'pizza', label: 'Pizza' },
  { value: 'resist', label: 'Resist' },
  { value: 'skull', label: 'Crâne' },
  { value: 'skullOutline', label: 'Contour de crâne' },
];

export const AVATAR_ACCESSORIES_COLOR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: '262e33', label: 'Noir' },
  { value: '3c4f5c', label: 'Gris ardoise' },
  { value: '724133', label: 'Écaille' },
  { value: '929598', label: 'Gris métal' },
  { value: '5199e4', label: 'Bleu' },
  { value: '25557c', label: 'Bleu marine' },
  { value: '65c9ff', label: 'Bleu clair' },
  { value: 'b58143', label: 'Doré' },
  { value: 'c0c0c0', label: 'Argent' },
  { value: 'ff5c5c', label: 'Rouge' },
  { value: 'ff488e', label: 'Rose' },
  { value: 'ffffff', label: 'Blanc' },
];

export const AVATAR_CLOTHES_COLOR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: '3c4f5c', label: 'Gris foncé' },
  { value: '65c9ff', label: 'Bleu ciel' },
  { value: '262e33', label: 'Noir' },
  { value: '5199e4', label: 'Bleu' },
  { value: '25557c', label: 'Bleu marine' },
  { value: '929598', label: 'Gris' },
  { value: 'a7ffc4', label: 'Menthe' },
  { value: 'b1e2ff', label: 'Bleu pastel' },
  { value: 'e6e6e6', label: 'Gris clair' },
  { value: 'ff5c5c', label: 'Rouge' },
  { value: 'ff488e', label: 'Rose' },
  { value: 'ffafb9', label: 'Rose clair' },
  { value: 'ffffb1', label: 'Jaune pastel' },
  { value: 'ffffff', label: 'Blanc' },
];

export const AVATAR_EYES_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'closed', label: 'Fermés' },
  { value: 'cry', label: 'En larmes' },
  { value: 'default', label: 'Par défaut' },
  { value: 'eyeRoll', label: 'Yeux au ciel' },
  { value: 'happy', label: 'Joyeux' },
  { value: 'hearts', label: 'Cœurs' },
  { value: 'side', label: 'Sur le côté' },
  { value: 'squint', label: 'Plissés' },
  { value: 'surprised', label: 'Surpris' },
  { value: 'wink', label: 'Clin d’œil' },
  { value: 'winkWacky', label: 'Clin d’œil fou' },
  { value: 'xDizzy', label: 'Étourdi' },
];

export const AVATAR_EYEBROWS_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'angry', label: 'En colère' },
  { value: 'angryNatural', label: 'Naturels en colère' },
  { value: 'default', label: 'Par défaut' },
  { value: 'defaultNatural', label: 'Naturels' },
  { value: 'flatNatural', label: 'Plats naturels' },
  { value: 'frownNatural', label: 'Froncés naturels' },
  { value: 'raisedExcited', label: 'Levés excités' },
  { value: 'raisedExcitedNatural', label: 'Naturels levés excités' },
  { value: 'sadConcerned', label: 'Tristes/inquiets' },
  { value: 'sadConcernedNatural', label: 'Naturels tristes/inquiets' },
  { value: 'unibrowNatural', label: 'Mono-sourcil' },
  { value: 'upDown', label: 'Haut/Bas' },
  { value: 'upDownNatural', label: 'Naturels haut/bas' },
];

export const AVATAR_MOUTH_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'concerned', label: 'Inquiet' },
  { value: 'default', label: 'Par défaut' },
  { value: 'disbelief', label: 'Incrédule' },
  { value: 'eating', label: 'Mange' },
  { value: 'grimace', label: 'Grimace' },
  { value: 'sad', label: 'Triste' },
  { value: 'screamOpen', label: 'Cri' },
  { value: 'serious', label: 'Sérieux' },
  { value: 'smile', label: 'Sourire' },
  { value: 'tongue', label: 'Langue' },
  { value: 'twinkle', label: 'Pétillant' },
  { value: 'vomit', label: 'Vomit' },
];

export const AVATAR_SKIN_COLOR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: '614335', label: 'Foncé' },
  { value: 'ae5d29', label: 'Brun' },
  { value: 'd08b5b', label: 'Mat' },
  { value: 'edb98a', label: 'Hâlé' },
  { value: 'f8d25c', label: 'Jaune' },
  { value: 'fd9841', label: 'Orange' },
  { value: 'ffdbb4', label: 'Clair' },
];

export const AVATAR_BACKGROUND_COLOR_OPTIONS: readonly AvatarOptionItem[] = [
  { value: 'b6e3f4', label: 'Bleu ciel' },
  { value: 'c0aede', label: 'Lavande' },
  { value: 'd1d4f9', label: 'Bleu clair' },
  { value: 'ffd5dc', label: 'Rose' },
  { value: 'ffdfbf', label: 'Pêche' },
  { value: '65c9ff', label: 'Bleu vif' },
  { value: 'transparent', label: 'Transparent' },
];
