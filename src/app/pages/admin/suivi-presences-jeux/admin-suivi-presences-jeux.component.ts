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
import { QuestFlags } from 'src/game/systems/QuestSystem';

export type PresenceMoment = 'soiree' | 'repas' | 'reception';

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

  filteredFamilles = computed(() => {
    const rows = this.sortedByConnexion(this.familles());
    const s = this.filterSoiree();
    const r = this.filterRepas();
    const rc = this.filterReception();
    if (s && r && rc) return rows;
    if (!s && !r && !rc) return rows;
    return rows.filter((fam) => this.familleMatchesMomentFilters(fam, s, r, rc));
  });

  constructor(private readonly ngSupabase: NgSupabaseService) {}

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
          'id, connexion, personne_principale, personnes!personnes_famille_id_fkey(id, nom, prenom, invite_reception, present_reception, invite_repas, present_repas, invite_soiree, present_soiree, decline_invitation)'
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

  showMoment(moment: PresenceMoment): boolean {
    if (moment === 'soiree') return this.filterSoiree();
    if (moment === 'repas') return this.filterRepas();
    return this.filterReception();
  }

  presenceLabel(person: any, moment: PresenceMoment): string {
    if (person?.decline_invitation) return 'Refus invitation';
    const inviteKey =
      moment === 'soiree' ? 'invite_soiree' : moment === 'repas' ? 'invite_repas' : 'invite_reception';
    const presentKey =
      moment === 'soiree' ? 'present_soiree' : moment === 'repas' ? 'present_repas' : 'present_reception';
    if (!person?.[inviteKey]) return 'Non invité';
    return person?.[presentKey] ? 'Oui' : 'Non';
  }

  presenceClass(person: any, moment: PresenceMoment): string {
    if (person?.decline_invitation) return 'presence--declined';
    const inviteKey =
      moment === 'soiree' ? 'invite_soiree' : moment === 'repas' ? 'invite_repas' : 'invite_reception';
    const presentKey =
      moment === 'soiree' ? 'present_soiree' : moment === 'repas' ? 'present_repas' : 'present_reception';
    if (!person?.[inviteKey]) return 'presence--na';
    return person?.[presentKey] ? 'presence--yes' : 'presence--no';
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

  private familleMatchesMomentFilters(fam: any, s: boolean, r: boolean, rc: boolean): boolean {
    const personnes: any[] = Array.isArray(fam?.personnes) ? fam.personnes : [];
    for (const p of personnes) {
      if (s && p.invite_soiree) return true;
      if (r && p.invite_repas) return true;
      if (rc && p.invite_reception) return true;
    }
    return false;
  }
}
