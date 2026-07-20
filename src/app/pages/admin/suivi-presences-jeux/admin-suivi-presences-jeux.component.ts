import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QuestFlags } from 'src/game/systems/QuestSystem';
import {
  EditFamilleReponsesDialogComponent,
  EditFamilleReponsesPerson,
  patchPersonnesReponses,
  toEditReponsesPerson,
} from './edit-famille-reponses-dialog.component';
import {
  PresenceMoment,
  presenceClass,
  presenceLabel,
  presenceMomentLabel,
} from '../shared/presence-response.util';

export type { PresenceMoment };

interface GameProgressRow {
  personne_id: number;
  flags: Record<string, unknown> | null;
  updated_at?: string | null;
}

@Component({
  selector: 'app-admin-suivi-presences-jeux',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-suivi-presences-jeux.component.html',
  styleUrls: ['./admin-suivi-presences-jeux.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSuiviPresencesJeuxComponent implements OnInit {
  readonly finalSeenKey = QuestFlags.finalSeen;

  loading = signal(false);
  familles = signal<any[]>([]);
  gameByPersonneId = signal<Map<number, GameProgressRow>>(new Map());

  /** Moments affichés / pris en compte pour le filtre de liste (défaut : les 3). */
  filterSoiree = signal(true);
  filterRepas = signal(true);
  filterReception = signal(true);
  filterAnniversaire = signal(true);
  /** Si vrai : uniquement les familles sans date de dernière connexion. */
  onlyNeverConnected = signal(false);
  /** Si faux (défaut) : uniquement les familles non vérifiées. Si vrai : toutes. */
  includeVerifiedFamilies = signal(false);

  filteredFamilles = computed(() => {
    let rows = this.sortedByConnexion(this.familles());
    const s = this.filterSoiree();
    const r = this.filterRepas();
    const rc = this.filterReception();
    const a = this.filterAnniversaire();
    if (!(s && r && rc && a) && (s || r || rc || a)) {
      rows = rows.filter((fam) => this.familleMatchesMomentFilters(fam, s, r, rc, a));
    }
    if (this.onlyNeverConnected()) {
      rows = rows.filter((fam) => fam?.connexion == null || String(fam.connexion).trim() === '');
    }
    if (!this.includeVerifiedFamilies()) {
      rows = rows.filter((fam) => !fam?.reponses_verifiees);
    }
    return rows;
  });

  constructor(
    private readonly ngSupabase: NgSupabaseService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      const res = await client
        .from('familles')
        .select(
          'id, connexion, personne_principale, reponses_verifiees, personnes!personnes_famille_id_fkey(id, nom, prenom, invite_reception, present_reception, invite_repas, present_repas, invite_soiree, present_soiree, invite_anniversaire, present_anniversaire, decline_invitation)'
        );
      if (res.error) throw res.error;
      const list = Array.isArray(res.data) ? (res.data as any[]) : [];
      this.familles.set(list);

      const personneIds: number[] = [];
      for (const f of list) {
        for (const p of f.personnes || []) {
          personneIds.push(Number(p.id));
        }
      }
      if (personneIds.length === 0) {
        this.gameByPersonneId.set(new Map());
        return;
      }
      const gp = await client.from('personne_game_progress').select('personne_id, flags, updated_at').in('personne_id', personneIds);
      if (gp.error) throw gp.error;
      const map = new Map<number, GameProgressRow>();
      for (const row of (gp.data || []) as any[]) {
        map.set(Number(row.personne_id), {
          personne_id: Number(row.personne_id),
          flags: (row.flags && typeof row.flags === 'object' ? row.flags : {}) as Record<string, unknown>,
          updated_at: row.updated_at,
        });
      }
      this.gameByPersonneId.set(map);
    } catch (e) {
      console.error('[AdminSuiviPresencesJeux] load', e);
      this.familles.set([]);
      this.gameByPersonneId.set(new Map());
    } finally {
      this.loading.set(false);
    }
  }

  getFamilyDisplayName(famille: any): string {
    if (!famille) return 'Famille';
    const principaleId = famille.personne_principale;
    const personnes: any[] = Array.isArray(famille.personnes) ? famille.personnes : [];
    if (principaleId != null) {
      const p = personnes.find((x) => Number(x.id) === Number(principaleId));
      if (p) return `Famille ${p.prenom} ${p.nom}`;
    }
    if (personnes.length > 0) {
      const first = personnes[0];
      return `Famille ${first.prenom} ${first.nom}`;
    }
    return `Famille #${famille.id}`;
  }

  formatConnexion(connexion: string | null | undefined): string {
    if (connexion == null || connexion === '') return 'Jamais connecté';
    try {
      return new Date(connexion).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return String(connexion);
    }
  }

  presenceLabel = presenceLabel;
  presenceClass = presenceClass;
  presenceMomentLabel = presenceMomentLabel;

  showMoment(moment: PresenceMoment): boolean {
    if (moment === 'soiree') return this.filterSoiree();
    if (moment === 'repas') return this.filterRepas();
    if (moment === 'anniversaire') return this.filterAnniversaire();
    return this.filterReception();
  }

  openEditReponses(fam: any): void {
    const familleId = Number(fam.id);
    const personnes = (fam.personnes || []).map(toEditReponsesPerson);

    const ref = this.dialog.open(EditFamilleReponsesDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        familyName: this.getFamilyDisplayName(fam),
        personnes,
        onUpdated: (updated: EditFamilleReponsesPerson[]) => this.applyUpdatedPersonnes(familleId, updated),
      },
    });

    ref.afterClosed().subscribe((updated) => {
      if (updated?.length) {
        this.applyUpdatedPersonnes(familleId, updated);
      }
    });
  }

  private applyUpdatedPersonnes(familleId: number, updated: EditFamilleReponsesPerson[]): void {
    this.familles.update((rows) =>
      rows.map((fam) => {
        if (Number(fam.id) !== familleId) return fam;
        return { ...fam, personnes: [...patchPersonnesReponses(fam.personnes || [], updated)] };
      })
    );
  }

  async toggleReponsesVerifiees(fam: any, checked: boolean): Promise<void> {
    const familleId = Number(fam.id);
    const previous = !!fam.reponses_verifiees;

    this.familles.update((rows) =>
      rows.map((f) => (Number(f.id) === familleId ? { ...f, reponses_verifiees: checked } : f))
    );

    try {
      const { error } = await this.ngSupabase
        .getClient()
        .from('familles')
        .update({ reponses_verifiees: checked })
        .eq('id', familleId);
      if (error) throw error;
    } catch (e) {
      console.error('[AdminSuiviPresencesJeux] toggleReponsesVerifiees', e);
      this.snackBar.open('Erreur : le statut « réponses vérifiées » n’a pas pu être enregistré.', 'Fermer', {
        duration: 5000,
      });
      this.familles.update((rows) =>
        rows.map((f) => (Number(f.id) === familleId ? { ...f, reponses_verifiees: previous } : f))
      );
    }
  }

  gameParticipated(personneId: number): boolean {
    return this.gameByPersonneId().has(personneId);
  }

  gameFinished(personneId: number): boolean {
    const row = this.gameByPersonneId().get(personneId);
    if (!row?.flags) return false;
    return row.flags[this.finalSeenKey] === true;
  }

  gameUpdated(personneId: number): string | null {
    const row = this.gameByPersonneId().get(personneId);
    const u = row?.updated_at;
    if (!u) return null;
    try {
      return new Date(u).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return null;
    }
  }

  trackByFamilleId(_: number, f: any): number {
    return f.id;
  }

  trackByPersonneId(_: number, p: any): number {
    return p.id;
  }

  private sortedByConnexion(rows: any[]): any[] {
    return [...rows].sort((a, b) => {
      const ca = a?.connexion;
      const cb = b?.connexion;
      if (ca == null && cb == null) return Number(a.id) - Number(b.id);
      if (ca == null) return 1;
      if (cb == null) return -1;
      return new Date(cb).getTime() - new Date(ca).getTime();
    });
  }

  private familleMatchesMomentFilters(fam: any, s: boolean, r: boolean, rc: boolean, a: boolean): boolean {
    const personnes: any[] = Array.isArray(fam?.personnes) ? fam.personnes : [];
    for (const p of personnes) {
      if (s && p.invite_soiree) return true;
      if (r && p.invite_repas) return true;
      if (rc && p.invite_reception) return true;
      if (a && p.invite_anniversaire) return true;
    }
    return false;
  }
}
