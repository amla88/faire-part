import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AvatarService } from 'src/app/services/avatar.service';
import {
  avatarDisplaySrc,
  AVATAR_PLACEHOLDER_SRC,
  canAdminGenerateAvatar,
  getFamilyDisplayName,
  hasAvatarConfig,
  isAdminGeneratedAvatar,
  normalizeAvatarFromPersonne,
  resolveAvatarDataUri,
} from './admin-avatars.utils';
import {
  buildAvatarUpsertOptionsJson,
  defaultAvatarDicebearFormState,
  randomizeAvatarDicebearForm,
} from 'src/app/utils/avatar-dicebear-form';

export interface AdminAvatarPersonneDetail {
  id: number;
  prenom: string;
  nom: string;
  hasAvatar: boolean;
  generatedByAdmin: boolean;
  canAdminGenerate: boolean;
  imageSrc: string;
  updatedLabel: string | null;
}

@Component({
  selector: 'app-admin-avatars-famille',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-avatars-famille.component.html',
  styleUrls: ['./admin-avatars-famille.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAvatarsFamilleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(NgSupabaseService);
  private readonly avatarService = inject(AvatarService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly generatingPersonneId = signal<number | null>(null);
  readonly familleId = signal<number | null>(null);
  readonly displayName = signal('');
  readonly personnes = signal<AdminAvatarPersonneDetail[]>([]);
  readonly placeholderSrc = AVATAR_PLACEHOLDER_SRC;

  readonly avatarCount = computed(() => this.personnes().filter((p) => p.hasAvatar).length);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isFinite(id)) {
        this.snackBar.open('Identifiant de famille invalide.', 'OK', { duration: 4000 });
        return;
      }
      this.familleId.set(id);
      void this.load(id);
    });
  }

  async load(familleId: number): Promise<void> {
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
            avatars ( id, seed, options, generated_by_admin, updated_at, created_at )
          )
        `
        )
        .eq('id', familleId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        this.displayName.set('');
        this.personnes.set([]);
        this.snackBar.open('Famille introuvable.', 'OK', { duration: 4000 });
        return;
      }

      const personnesRaw = Array.isArray(data.personnes) ? data.personnes : [];
      const mapped: AdminAvatarPersonneDetail[] = personnesRaw.map((p) => {
        const row = p as {
          id: number;
          prenom?: string;
          nom?: string;
        };
        const avatar = normalizeAvatarFromPersonne(p);
        const avatarsRaw = (p as { avatars?: unknown }).avatars;
        const avRow = Array.isArray(avatarsRaw) ? avatarsRaw[0] : avatarsRaw;
        const avObj = avRow && typeof avRow === 'object' ? (avRow as Record<string, unknown>) : null;
        const updatedAt = avObj?.['updated_at'] ?? avObj?.['created_at'];
        const hasAvatar = hasAvatarConfig(avatar);
        const generatedByAdmin = isAdminGeneratedAvatar(avatar);
        const dataUri = resolveAvatarDataUri(avatar, this.avatarService);
        return {
          id: Number(row.id),
          prenom: row.prenom ?? '',
          nom: row.nom ?? '',
          hasAvatar,
          generatedByAdmin,
          canAdminGenerate: canAdminGenerateAvatar(avatar),
          imageSrc: avatarDisplaySrc(dataUri),
          updatedLabel: hasAvatar && updatedAt ? this.formatDate(String(updatedAt)) : null,
        };
      });

      mapped.sort((a, b) => {
        const cmp = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'base' });
      });

      this.displayName.set(
        getFamilyDisplayName({
          id: Number(data.id),
          personne_principale: data.personne_principale,
          personnes: mapped.map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom })),
        })
      );
      this.personnes.set(mapped);
    } catch (e) {
      console.error('admin avatars famille load', e);
      this.displayName.set('');
      this.personnes.set([]);
      this.snackBar.open('Impossible de charger cette famille.', 'OK', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('fr-BE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  async generateRandomAvatar(personne: AdminAvatarPersonneDetail): Promise<void> {
    if (!personne.canAdminGenerate || this.generatingPersonneId() != null) return;

    this.generatingPersonneId.set(personne.id);
    try {
      const form = defaultAvatarDicebearFormState();
      randomizeAvatarDicebearForm(form);
      const options = buildAvatarUpsertOptionsJson(form);
      const seed = form.seed;

      const client = this.supabase.getClient();
      const { data, error } = await client.rpc('generate_avatar_for_admin', {
        p_personne_id: personne.id,
        p_seed: seed,
        p_options: options,
      });

      if (error) throw error;

      const dataUri = this.avatarService.generateDataUri(options);
      this.personnes.update((list) =>
        list.map((p) =>
          p.id === personne.id
            ? {
                ...p,
                hasAvatar: true,
                generatedByAdmin: true,
                canAdminGenerate: false,
                imageSrc: avatarDisplaySrc(dataUri),
                updatedLabel: data?.updated_at
                  ? this.formatDate(String(data.updated_at))
                  : this.formatDate(new Date().toISOString()),
              }
            : p
        )
      );

      this.snackBar.open(
        `Avatar généré pour ${personne.prenom} ${personne.nom}.`,
        'OK',
        { duration: 3000 }
      );
    } catch (e: unknown) {
      console.error('generate avatar for admin', e);
      const msg =
        e && typeof e === 'object' && 'message' in e && String((e as { message: string }).message).includes('avatar_already_exists')
          ? 'Cet invité a déjà un avatar — génération impossible.'
          : 'Impossible de générer l\'avatar.';
      this.snackBar.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.generatingPersonneId.set(null);
    }
  }
}
