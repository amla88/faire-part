import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { AvatarLabelExportService } from './avatar-label-export.service';
import {
  AvatarLabelSettings,
  DEFAULT_LABEL_BACKGROUND,
  loadAvatarLabelSettings,
  saveAvatarLabelSettings,
} from './avatar-label-export.types';
import {
  avatarDisplaySrc,
  AVATAR_PLACEHOLDER_SRC,
  getFamilyDisplayName,
  hasAvatarConfig,
  isAdminGeneratedAvatar,
  normalizeAvatarFromPersonne,
  resolveAvatarDataUri,
} from './admin-avatars.utils';

export interface AdminAvatarPersonneView {
  id: number;
  prenom: string;
  nom: string;
  hasAvatar: boolean;
  generatedByAdmin: boolean;
  imageSrc: string;
}

export interface AdminAvatarFamilleView {
  id: number;
  displayName: string;
  personnes: AdminAvatarPersonneView[];
  avatarCount: number;
  memberCount: number;
}

@Component({
  selector: 'app-admin-avatars',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormsModule,
  ],
  templateUrl: './admin-avatars.component.html',
  styleUrls: ['./admin-avatars.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAvatarsComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);
  private readonly avatarService = inject(AvatarService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly labelExport = inject(AvatarLabelExportService);

  readonly loading = signal(false);
  readonly exportingFamilleId = signal<number | null>(null);
  readonly filterText = signal('');
  readonly familles = signal<AdminAvatarFamilleView[]>([]);
  readonly placeholderSrc = AVATAR_PLACEHOLDER_SRC;
  readonly labelSettings = signal<AvatarLabelSettings>(loadAvatarLabelSettings());
  readonly defaultLabelBackground = DEFAULT_LABEL_BACKGROUND;

  readonly labelBackgroundPreview = computed(() =>
    this.labelSettings().backgroundDataUrl ?? DEFAULT_LABEL_BACKGROUND
  );

  readonly displayedColumns = ['famille', 'membres', 'avatars', 'action'];

  readonly filteredFamilles = computed(() => {
    const q = (this.filterText() || '').toLowerCase().trim();
    const list = this.familles();
    if (!q) return list;
    return list.filter((f) => {
      if (f.displayName.toLowerCase().includes(q)) return true;
      if (String(f.id).includes(q)) return true;
      return f.personnes.some((p) =>
        `${p.prenom} ${p.nom}`.toLowerCase().includes(q)
      );
    });
  });

  readonly totalAvatars = computed(() =>
    this.filteredFamilles().reduce((acc, f) => acc + f.avatarCount, 0)
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('familles')
        .select(
          `
          id,
          personne_principale,
          personnes!personnes_famille_id_fkey (
            id,
            prenom,
            nom,
            avatars ( id, seed, options, generated_by_admin )
          )
        `
        );

      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((raw) => this.mapFamille(raw));
      mapped.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })
      );
      this.familles.set(mapped);
    } catch (e) {
      console.error('admin avatars load', e);
      this.familles.set([]);
      this.snackBar.open(
        'Impossible de charger les avatars. Vérifiez la connexion admin.',
        'OK',
        { duration: 5000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  private mapFamille(raw: unknown): AdminAvatarFamilleView {
    const f = raw as {
      id: number;
      personne_principale?: number | null;
      personnes?: unknown[];
    };
    const personnesRaw = Array.isArray(f.personnes) ? f.personnes : [];
    const personnes: AdminAvatarPersonneView[] = personnesRaw.map((p) => {
      const row = p as { id: number; prenom?: string; nom?: string };
      const avatar = normalizeAvatarFromPersonne(p);
      const hasAvatar = hasAvatarConfig(avatar);
      const dataUri = resolveAvatarDataUri(avatar, this.avatarService);
      return {
        id: Number(row.id),
        prenom: row.prenom ?? '',
        nom: row.nom ?? '',
        hasAvatar,
        generatedByAdmin: isAdminGeneratedAvatar(avatar),
        imageSrc: avatarDisplaySrc(dataUri),
      };
    });

    personnes.sort((a, b) => {
      const cmp = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
    });

    return {
      id: Number(f.id),
      displayName: getFamilyDisplayName({
        id: Number(f.id),
        personne_principale: f.personne_principale,
        personnes: personnes.map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom })),
      }),
      personnes,
      avatarCount: personnes.filter((p) => p.hasAvatar).length,
      memberCount: personnes.length,
    };
  }

  persistLabelSettings(): void {
    saveAvatarLabelSettings(this.labelSettings());
  }

  updateLabelWidth(value: string): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.labelSettings.update((s) => ({ ...s, widthMm: Math.min(200, Math.max(20, n)) }));
    this.persistLabelSettings();
  }

  updateLabelHeight(value: string): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.labelSettings.update((s) => ({ ...s, heightMm: Math.min(200, Math.max(20, n)) }));
    this.persistLabelSettings();
  }

  updateWeddingDate(value: string): void {
    this.labelSettings.update((s) => ({ ...s, weddingDate: value }));
    this.persistLabelSettings();
  }

  async onLabelBackgroundSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Choisissez une image (PNG, JPG…).', 'OK', { duration: 4000 });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      this.snackBar.open('Image trop lourde (max 4 Mo).', 'OK', { duration: 4000 });
      return;
    }
    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      this.labelSettings.update((s) => ({ ...s, backgroundDataUrl: dataUrl }));
      this.persistLabelSettings();
      this.snackBar.open('Fond d\'étiquette enregistré.', 'OK', { duration: 2500 });
    } catch {
      this.snackBar.open('Impossible de lire l\'image.', 'OK', { duration: 4000 });
    }
  }

  resetLabelBackground(): void {
    this.labelSettings.update((s) => ({ ...s, backgroundDataUrl: null }));
    this.persistLabelSettings();
    this.snackBar.open('Fond par défaut restauré.', 'OK', { duration: 2500 });
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async exportLabel(famille: AdminAvatarFamilleView, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (this.exportingFamilleId() != null) return;

    this.exportingFamilleId.set(famille.id);
    try {
      await this.labelExport.exportPdf(
        {
          displayName: famille.displayName,
          personnes: famille.personnes.map((p) => ({
            prenom: p.prenom,
            nom: p.nom,
            imageSrc: p.imageSrc,
          })),
        },
        this.labelSettings()
      );
      this.snackBar.open(`Étiquette exportée — ${famille.displayName}`, 'OK', { duration: 3000 });
    } catch (e) {
      console.error('export label', e);
      this.snackBar.open('Export de l\'étiquette impossible.', 'OK', { duration: 5000 });
    } finally {
      this.exportingFamilleId.set(null);
    }
  }
}
