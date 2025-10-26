import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AvatarService } from 'src/app/services/avatar.service';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AuthService } from 'src/app/services/auth.service';

interface AvatarStyle {
  name: string;
  label: string;
  // collection removed: generation delegated to AvatarService by style name
}

interface AvatarOptions {
  [key: string]: string | number | boolean;
}

@Component({
  selector: 'app-avatar-editor',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
      MatSnackBarModule,
  ],
  templateUrl: './avatar-editor.component.html',
  styleUrls: ['./avatar-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarEditorComponent {
  // Styles disponibles
  readonly styles: AvatarStyle[] = [
    { name: 'personas', label: 'Personas' },
    { name: 'avataaars', label: 'Avataaars' },
    { name: 'dylan', label: 'Dylan' },
    { name: 'openPeeps', label: 'Open Peeps' },
    { name: 'pixelArt', label: 'Pixel Art' },
  ];

  // Signaux pour l'état
  selectedStyle = signal<string>('personas');
  seed = signal<string>('default-seed');
  size = signal<number>(256);
  isLoading = signal<boolean>(false);

  // Avatar générés
  avatarDataUri = signal<string>('');

  // snack bar via inject (préférer inject() selon consignes)
  private snackBar = inject(MatSnackBar);
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);
  private avatarService = inject(AvatarService);

  // état d'enregistrement
  isSaving = signal<boolean>(false);

  // Computed pour l'avatar courant
  currentStyle = computed(() => {
    return this.styles.find((s) => s.name === this.selectedStyle());
  });

  // Effect pour régénérer l'avatar quand les options changent
  constructor() {
    effect(() => {
      this.generateAvatar();
    });
    // Apply cached avatar if present in AuthService (selected when user chose a person)
    const user = this.auth.getUser();
    if (user && user.selected_personne_id && user.avatars && user.avatars[user.selected_personne_id]) {
      const a = user.avatars[user.selected_personne_id];
      if (a.seed) this.seed.set(a.seed);
      if (a.options) {
        const opts = a.options as any;
        if (opts.style) this.selectedStyle.set(opts.style);
        if (typeof opts.size === 'number') this.size.set(opts.size);
      }
    }
  }

  /**
   * Charge l'avatar depuis la DB (via RPC sécurisée) et applique seed/options si trouvés.
   */
  async loadAvatar(): Promise<void> {
    try {
      const user = this.auth.getUser();
      if (!user || !user.selected_personne_id) return;

      const token = this.auth.getToken();
      if (!token) return;

      this.isLoading.set(true);

      const client = this.supabase.getClient();
      const rpcRes = await client.rpc('get_avatar_for_token', {
        p_token: token,
        p_personne_id: user.selected_personne_id,
      });

      if (rpcRes.error) {
        console.error('Erreur get_avatar_for_token', rpcRes.error);
        return;
      }

      let data: any = rpcRes.data;
      if (Array.isArray(data)) data = data[0] || null;
      if (!data) return;

      if (data.seed) this.seed.set(data.seed);
      if (data.options) {
        const opts = data.options as any;
        if (opts.style) this.selectedStyle.set(opts.style);
        if (typeof opts.size === 'number') this.size.set(opts.size);
      }
    } catch (err) {
      console.error('Erreur lors du chargement de l\'avatar', err);
    } finally {
      this.isLoading.set(false);
    }
  }


  /**
   * Génère l'avatar avec les options actuelles
   */
  generateAvatar(): void {
    try {
      this.isLoading.set(true);

      const style = this.currentStyle();
      if (!style) return;

      const dataUri = this.avatarService.generateDataUri(style.name, this.seed(), this.size());
      if (dataUri) this.avatarDataUri.set(dataUri);
    } catch (error) {
      console.error('Erreur lors de la génération de l\'avatar:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Change le style d'avatar
   */
  onStyleChange(styleName: string): void {
    this.selectedStyle.set(styleName);
  }

  /**
   * Change la seed (régénère un nouvel avatar)
   */
  onSeedChange(newSeed: string): void {
    this.seed.set(newSeed);
  }

  /**
   * Change la taille
   */
  onSizeChange(newSize: number): void {
    this.size.set(newSize);
  }

  /**
   * Génère une nouvelle seed aléatoire
   */
  generateRandomSeed(): void {
    const randomSeed = Math.random().toString(36).substring(2, 15);
    this.seed.set(randomSeed);
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
      style: this.selectedStyle(),
      size: this.size(),
    } as Record<string, unknown>;

    this.isSaving.set(true);
    try {
      const client = this.supabase.getClient();
      const token = this.auth.getToken();
      if (!token) {
        this.snackBar.open('Token manquant — reconnectez-vous', 'OK', { duration: 4000 });
        return;
      }

      const rpcRes = await client.rpc('upsert_avatar_for_token', {
        p_token: token,
        p_personne_id: personneId,
        p_seed: seed,
        p_options: options,
      });

      if (rpcRes.error) {
        console.error('RPC upsert_avatar_for_token error', rpcRes.error);
        this.snackBar.open('Erreur lors de l\'enregistrement de l\'avatar: ' + (rpcRes.error.message || rpcRes.error.code || ''), 'OK', { duration: 5000 });
        return;
      }

      // update local cache with returned avatar row (RPC returns the avatar row as jsonb)
      let avatarRow: any = rpcRes.data;
      if (Array.isArray(avatarRow)) avatarRow = avatarRow[0] || null;

      // generate PNG data URI for the saved avatar and store in cache
      try {
        const style = this.currentStyle();
        const imgData = this.avatarService.generateDataUri(style?.name, seed, 35);
        if (avatarRow && imgData) {
          avatarRow.imageDataUri = imgData;
        }
        this.auth.setAvatarInCache(personneId, avatarRow || { seed, options });
      } catch (e) {
        console.error('Erreur generation image pour cache', e);
        if (avatarRow) this.auth.setAvatarInCache(personneId, avatarRow);
      }

      this.snackBar.open('Avatar enregistré', undefined, { duration: 2000 });
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

  /**
   * Copie le data URI dans le presse-papiers
   */
  copyToClipboard(): void {
    const data = this.avatarDataUri();
    if (!data) {
      this.snackBar.open('Aucun avatar à copier', 'OK', { duration: 3000 });
      return;
    }

    if (!navigator.clipboard) {
      this.snackBar.open('Presse-papiers non supporté', 'OK', { duration: 3000 });
      return;
    }

    navigator.clipboard.writeText(data)
      .then(() => this.snackBar.open('Data URI copié', undefined, { duration: 2000 }))
      .catch((err) => {
        console.error('Erreur copie presse-papiers', err);
        this.snackBar.open('Impossible de copier dans le presse-papiers', 'OK', { duration: 3000 });
      });
  }
}
