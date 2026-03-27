import {
  Component,
  ChangeDetectionStrategy,
  signal,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AvatarService } from 'src/app/services/avatar.service';
import { AuthService } from 'src/app/services/auth.service';

type ColorPickerTarget = 'hair' | 'clothes' | 'skin' | 'background' | 'accessories';

@Component({
  selector: 'app-avatar-editor',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './avatar-editor.component.html',
  styleUrls: ['./avatar-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarEditorComponent {
  readonly transparentColor = 'transparent';
  readonly noneOptionValue = 'none';
  openColorPickerTarget = signal<ColorPickerTarget | null>(null);
  customColorInput = signal('#000000');

  // Signaux pour l'état
  seed = signal<string>('default-seed');
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Avatar généré
  avatarDataUri = signal<string>('');

  // snack bar via inject (préférer inject() selon consignes)
  private snackBar = inject(MatSnackBar);
  private auth = inject(AuthService);
  private avatarService = inject(AvatarService);

  // Options pour avataaar
  top = signal('longButNotTooLong');
  accessories = signal('kurt');
  accessoriesColor = signal('262e33');
  hairColor = signal('a55728');
  facialHair = signal('beardMedium');
  clothing = signal('blazerAndShirt');
  clothingGraphic = signal('bat');
  clothesColor = signal('3c4f5c');
  eyes = signal('default');
  eyebrows = signal('default');
  mouth = signal('default');
  skinColor = signal('edb98a');
  backgroundColor = signal('b6e3f4');

  // Listes d'options pour les selects
  readonly topOptions = [
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
  readonly accessoriesOptions = [
    { value: 'none', label: 'Aucun' },
    { value: 'eyepatch', label: 'Cache-œil' },
    { value: 'kurt', label: 'Lunettes Kurt' },
    { value: 'prescription01', label: 'Lunettes de vue 1' },
    { value: 'prescription02', label: 'Lunettes de vue 2' },
    { value: 'round', label: 'Lunettes rondes' },
    { value: 'sunglasses', label: 'Lunettes de soleil' },
    { value: 'wayfarers', label: 'Wayfarers' },
  ];
  readonly hairColorOptions = [
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
  readonly facialHairOptions = [
    { value: 'none', label: 'Aucun' },
    { value: 'beardLight', label: 'Barbe légère' },
    { value: 'beardMajestic', label: 'Barbe majestueuse' },
    { value: 'beardMedium', label: 'Barbe moyenne' },
    { value: 'moustacheFancy', label: 'Moustache chic' },
    { value: 'moustacheMagnum', label: 'Moustache Magnum' },
  ];
  readonly clothingOptions = [
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
  readonly clothingGraphicOptions = [
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
  /** Montures / accessoires (lunettes, etc.) — tons neutres et métalliques */
  readonly accessoriesColorOptions = [
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
  readonly clothesColorOptions = [
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
  readonly eyesOptions = [
    { value: 'closed', label: 'Fermés' },
    { value: 'cry', label: 'En larmes' },
    { value: 'default', label: 'Par défaut' },
    { value: 'eyeRoll', label: 'Yeux au ciel' },
    { value: 'happy', label: 'Joyeux' },
    { value: 'hearts', label: 'Cœurs' },
    { value: 'side', label: 'Sur le côté' },
    { value: 'squint', label: 'Plissés' },
    { value: 'surprised', label: 'Surpris' },
    { value: 'wink', label: 'Clin d\'œil' },
    { value: 'winkWacky', label: 'Clin d\'œil fou' },
    { value: 'xDizzy', label: 'Étourdi' },
  ];
  readonly eyebrowsOptions = [
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
  readonly mouthOptions = [
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
  readonly skinColorOptions = [
    { value: '614335', label: 'Foncé' },
    { value: 'ae5d29', label: 'Brun' },
    { value: 'd08b5b', label: 'Mat' },
    { value: 'edb98a', label: 'Hâlé' },
    { value: 'f8d25c', label: 'Jaune' },
    { value: 'fd9841', label: 'Orange' },
    { value: 'ffdbb4', label: 'Clair' },
  ];
  readonly backgroundColorOptions = [
    { value: 'b6e3f4', label: 'Bleu ciel' },
    { value: 'c0aede', label: 'Lavande' },
    { value: 'd1d4f9', label: 'Bleu clair' },
    { value: 'ffd5dc', label: 'Rose' },
    { value: 'ffdfbf', label: 'Pêche' },
    { value: '65c9ff', label: 'Bleu vif' },
    { value: 'transparent', label: 'Transparent' },
  ];

  private readonly defaultColorByTarget: Record<ColorPickerTarget, string> = {
    hair: 'a55728',
    clothes: '3c4f5c',
    skin: 'edb98a',
    background: 'b6e3f4',
    accessories: '262e33',
  };


  // Effect pour régénérer l'avatar quand les options changent
  constructor() {
    effect(() => {
      this.generateAvatar();
    });
    // Apply cached avatar if present in AuthService (selected when user chose a person)
    const user = this.auth.getUser();
    if (user && user.selected_personne_id && user.avatars && user.avatars[user.selected_personne_id]) {
      const a = user.avatars[user.selected_personne_id];
      if (a.options) {
        this.applyOptions(a.options);
      }
    }
  }

  private applyOptions(options: any) {
    if (!options) return;
    this.seed.set(options.seed || 'default-seed');
    this.top.set(options.top?.[0] || 'longButNotTooLong');
    this.accessories.set(options.accessoriesProbability === 0 ? this.noneOptionValue : (options.accessories?.[0] || 'kurt'));
    this.hairColor.set(options.hairColor?.[0] || 'a55728');
    this.facialHair.set(options.facialHairProbability === 0 ? this.noneOptionValue : (options.facialHair?.[0] || 'beardMedium'));
    this.clothing.set(options.clothing?.[0] || 'blazerAndShirt');
    this.clothingGraphic.set(options.clothingGraphicProbability === 0 ? this.noneOptionValue : (options.clothingGraphic?.[0] || 'bat'));
    this.clothesColor.set(options.clothesColor?.[0] || '3c4f5c');
    this.accessoriesColor.set(options.accessoriesColor?.[0] || '262e33');
    this.eyes.set(options.eyes?.[0] || 'default');
    this.eyebrows.set(options.eyebrows?.[0] || 'default');
    this.mouth.set(options.mouth?.[0] || 'default');
    this.skinColor.set(options.skinColor?.[0] || 'edb98a');
    this.backgroundColor.set(options.backgroundColor?.[0] || 'b6e3f4');
  }

  /**
   * Génère l'avatar avec les options actuelles
   */
  generateAvatar(): void {
    try {
      this.isLoading.set(true);

      const options = {
        seed: this.seed(),
        size: 256,
        top: [this.top()],
        accessories: [this.getDicebearValue(this.accessories(), 'kurt')],
        accessoriesProbability: this.getProbability(this.accessories()),
        accessoriesColor: [this.accessoriesColor()],
        hairColor: [this.hairColor()],
        hatColor: [this.hairColor()],
        facialHair: [this.getDicebearValue(this.facialHair(), 'beardMedium')],
        facialHairColor: [this.hairColor()],
        facialHairProbability: this.getProbability(this.facialHair()),
        clothing: [this.clothing()],
        clothingGraphic: [this.getDicebearValue(this.clothingGraphic(), 'bat')],
        clothingGraphicProbability: this.getProbability(this.clothingGraphic()),
        clothesColor: [this.clothesColor()],
        eyes: [this.eyes()],
        eyebrows: [this.eyebrows()],
        mouth: [this.mouth()],
        skinColor: [this.skinColor()],
        backgroundColor: [this.backgroundColor()],
      };

      const dataUri = this.avatarService.generateDataUri(options);
      if (dataUri) this.avatarDataUri.set(dataUri);
    } catch (error) {
      console.error('Erreur lors de la génération de l\'avatar:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Génère une nouvelle seed aléatoire
   */
  generateRandomSeed(): void {
    this.seed.set(Math.random().toString(36).substring(2, 15));

    this.top.set(this.topOptions[Math.floor(Math.random() * this.topOptions.length)].value);
    this.accessories.set(this.accessoriesOptions[Math.floor(Math.random() * this.accessoriesOptions.length)].value);
    this.hairColor.set(this.hairColorOptions[Math.floor(Math.random() * this.hairColorOptions.length)].value);
    this.facialHair.set(this.facialHairOptions[Math.floor(Math.random() * this.facialHairOptions.length)].value);
    this.clothing.set(this.clothingOptions[Math.floor(Math.random() * this.clothingOptions.length)].value);
    this.clothingGraphic.set(this.clothingGraphicOptions[Math.floor(Math.random() * this.clothingGraphicOptions.length)].value);
    this.clothesColor.set(this.clothesColorOptions[Math.floor(Math.random() * this.clothesColorOptions.length)].value);
    this.accessoriesColor.set(
      this.accessoriesColorOptions[Math.floor(Math.random() * this.accessoriesColorOptions.length)].value
    );
    this.eyes.set(this.eyesOptions[Math.floor(Math.random() * this.eyesOptions.length)].value);
    this.eyebrows.set(this.eyebrowsOptions[Math.floor(Math.random() * this.eyebrowsOptions.length)].value);
    this.mouth.set(this.mouthOptions[Math.floor(Math.random() * this.mouthOptions.length)].value);
    this.skinColor.set(this.skinColorOptions[Math.floor(Math.random() * this.skinColorOptions.length)].value);
    this.backgroundColor.set(this.backgroundColorOptions[Math.floor(Math.random() * this.backgroundColorOptions.length)].value);
  }

  /**
   * Sauvegarde l'avatar (seed + options JSON) associé à la personne sélectionnée.
   * Upsert : un seul avatar par personne.
   */
  async saveAvatar(): Promise<void> {
    const user = this.auth.getUser();
    if (!user || !user.selected_personne_id) {
      this.snackBar.open('Aucune personne sélectionnée. Veuillez choisir une personne.', 'OK', { duration: 4000 });
      return;
    }

    const personneId = user.selected_personne_id as number;
    const seed = this.seed();
    const options = {
      seed: this.seed(),
      top: [this.top()],
      accessories: [this.getDicebearValue(this.accessories(), 'kurt')],
      accessoriesProbability: this.getProbability(this.accessories()),
      accessoriesColor: [this.accessoriesColor()],
      hairColor: [this.hairColor()],
      hatColor: [this.hairColor()],
      facialHair: [this.getDicebearValue(this.facialHair(), 'beardMedium')],
      facialHairColor: [this.hairColor()],
      facialHairProbability: this.getProbability(this.facialHair()),
      clothing: [this.clothing()],
      clothingGraphic: [this.getDicebearValue(this.clothingGraphic(), 'bat')],
      clothingGraphicProbability: this.getProbability(this.clothingGraphic()),
      clothesColor: [this.clothesColor()],
      eyes: [this.eyes()],
      eyebrows: [this.eyebrows()],
      mouth: [this.mouth()],
      skinColor: [this.skinColor()],
      backgroundColor: [this.backgroundColor()],
    };

    this.isSaving.set(true);
    try {
      const avatarRow = await this.avatarService.saveAvatar(seed, options, personneId, this.avatarDataUri());
      if(avatarRow) {
          this.snackBar.open('Avatar enregistré', undefined, { duration: 2000 });
      } else {
          this.snackBar.open('Impossible d\'enregistrer l\'avatar', 'OK', { duration: 4000 });
      }
    } catch (err) {
      console.error('Erreur saveAvatar', err);
      this.snackBar.open('Impossible d\'enregistrer l\'avatar', 'OK', { duration: 4000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Télécharge l'avatar en PNG
   */
  downloadAvatar(): void {
    try {
      const data = this.avatarDataUri();
      if (!data) {
        this.snackBar.open('Aucun avatar disponible pour le téléchargement', 'OK', { duration: 3000 });
        return;
      }

      const link = document.createElement('a');
      link.href = data;
      link.download = `avatar-${this.seed()}.png`;
      // append to body to ensure click works in all browsers
      document.body.appendChild(link);
      link.click();
      link.remove();

      this.snackBar.open('Téléchargement lancé', undefined, { duration: 2000 });
    } catch (err) {
      console.error('Erreur lors du téléchargement de l\'avatar', err);
      this.snackBar.open('Impossible de télécharger l\'avatar', 'OK', { duration: 3000 });
    }
  }

  private setDefaultOptions(): void {
    this.seed.set('default-seed');
    this.top.set('longButNotTooLong');
    this.accessories.set('kurt');
    this.accessoriesColor.set('262e33');
    this.hairColor.set('a55728');
    this.facialHair.set('beardMedium');
    this.clothing.set('blazerAndShirt');
    this.clothingGraphic.set('bat');
    this.clothesColor.set('3c4f5c');
    this.eyes.set('default');
    this.eyebrows.set('default');
    this.mouth.set('default');
    this.skinColor.set('edb98a');
    this.backgroundColor.set('b6e3f4');
  }

  async resetAvatar(): Promise<void> {
    const user = this.auth.getUser();
    if (!user || !user.selected_personne_id) {
        this.setDefaultOptions();
        this.snackBar.open('Avatar réinitialisé aux valeurs par défaut.', undefined, { duration: 2000 });
        return;
    }

    this.isLoading.set(true);
    try {
        const row = await this.avatarService.loadAvatarFromRpc(user.selected_personne_id);
        if (row && row.options) {
            this.applyOptions(row.options);
            this.snackBar.open('Avatar restauré depuis la sauvegarde.', undefined, { duration: 2000 });
        } else {
            this.setDefaultOptions();
            this.snackBar.open('Aucun avatar sauvegardé. Réinitialisation aux valeurs par défaut.', undefined, { duration: 3000 });
        }
    } catch (err) {
        console.error('Erreur lors de la réinitialisation de l\'avatar', err);
        this.setDefaultOptions(); // reset to default on error
        this.snackBar.open('Erreur lors de la restauration. Réinitialisation aux valeurs par défaut.', 'OK', { duration: 4000 });
    } finally {
        this.isLoading.set(false);
    }
  }

  openColorPicker(target: ColorPickerTarget): void {
    this.openColorPickerTarget.set(target);
    this.customColorInput.set(this.getPickerInputColor(target));
  }

  closeColorPicker(): void {
    this.openColorPickerTarget.set(null);
  }

  getCurrentColorValue(target: ColorPickerTarget): string {
    switch (target) {
      case 'hair':
        return this.hairColor();
      case 'clothes':
        return this.clothesColor();
      case 'skin':
        return this.skinColor();
      case 'background':
        return this.backgroundColor();
      case 'accessories':
        return this.accessoriesColor();
    }
  }

  getCurrentColorHex(target: ColorPickerTarget): string {
    const current = this.getCurrentColorValue(target);
    if (current === this.transparentColor) {
      return this.defaultColorByTarget[target];
    }
    return current;
  }

  getCurrentColorDisplay(target: ColorPickerTarget): string {
    const current = this.getCurrentColorValue(target);
    if (current === this.transparentColor) {
      return 'Transparent';
    }
    return `#${this.getCurrentColorHex(target).toUpperCase()}`;
  }

  getPresetColors(target: ColorPickerTarget): { value: string; label: string }[] {
    switch (target) {
      case 'hair':
        return this.hairColorOptions;
      case 'clothes':
        return this.clothesColorOptions;
      case 'skin':
        return this.skinColorOptions;
      case 'background':
        return this.backgroundColorOptions;
      case 'accessories':
        return this.accessoriesColorOptions;
    }
  }

  setPresetColor(target: ColorPickerTarget, value: string): void {
    this.applyColorByTarget(target, value);
    this.customColorInput.set(this.getPickerInputColor(target));
  }

  applyCustomColor(target: ColorPickerTarget, value: string): void {
    const normalized = this.normalizeHexColor(value);
    if (!normalized) return;
    this.applyColorByTarget(target, normalized);
    this.customColorInput.set(`#${normalized}`);
  }

  onCustomColorInput(target: ColorPickerTarget, value: string): void {
    this.applyCustomColor(target, value);
  }

  private applyColorByTarget(target: ColorPickerTarget, value: string): void {
    switch (target) {
      case 'hair':
        this.hairColor.set(value);
        break;
      case 'clothes':
        this.clothesColor.set(value);
        break;
      case 'skin':
        this.skinColor.set(value);
        break;
      case 'background':
        this.backgroundColor.set(value);
        break;
      case 'accessories':
        this.accessoriesColor.set(value);
        break;
    }
  }

  private getPickerInputColor(target: ColorPickerTarget): string {
    const current = this.getCurrentColorValue(target);
    if (current === this.transparentColor) {
      return `#${this.defaultColorByTarget[target]}`;
    }
    return `#${this.getCurrentColorHex(target)}`;
  }

  private normalizeHexColor(input: string): string | null {
    const raw = input.trim().replace('#', '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(raw)) {
      return raw
        .split('')
        .map((char) => `${char}${char}`)
        .join('');
    }
    if (/^[0-9a-f]{6}$/.test(raw)) {
      return raw;
    }
    return null;
  }

  private getProbability(value: string): number {
    return value === this.noneOptionValue ? 0 : 100;
  }

  private getDicebearValue(value: string, fallback: string): string {
    return value === this.noneOptionValue ? fallback : value;
  }
}
