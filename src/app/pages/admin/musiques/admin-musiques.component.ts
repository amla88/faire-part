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
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';

export type MusiqueStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface AdminMusiqueRow {
  id: number;
  created_at: string;
  titre: string;
  auteur: string;
  lien: string;
  commentaire: string;
  status: 'pending' | 'approved' | 'rejected';
  album_image_url: string | null;
  spotify_uri: string | null;
  spotify_track_id: string | null;
  personnes: {
    id: number;
    prenom: string;
    nom: string;
    famille_id: number;
  } | null;
}

@Component({
  selector: 'app-admin-musiques',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCheckboxModule,
  ],
  templateUrl: './admin-musiques.component.html',
  styleUrls: ['./admin-musiques.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMusiquesComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly updatingId = signal<number | null>(null);
  readonly playlistBusy = signal(false);
  /** IDs des lignes cochées pour envoi vers Spotify */
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly rows = signal<AdminMusiqueRow[]>([]);
  readonly filterText = signal('');
  readonly statusFilter = signal<MusiqueStatusFilter>('all');

  /** URIs Spotify des lignes cochées (dédoublonnés), pour le bouton playlist. */
  readonly selectedSpotifyUriList = computed(() => {
    const sel = this.selectedIds();
    const byId = new Map(this.rows().map((r) => [r.id, r]));
    const uris: string[] = [];
    for (const id of sel) {
      const row = byId.get(id);
      if (!row) {
        continue;
      }
      const uri = this.spotifyUriForRow(row);
      if (uri) {
        uris.push(uri);
      }
    }
    return [...new Set(uris)];
  });

  readonly filteredRows = computed(() => {
    const q = (this.filterText() || '').toLowerCase().trim();
    const st = this.statusFilter();
    return this.rows().filter((r) => {
      if (st !== 'all' && r.status !== st) return false;
      if (!q) return true;
      const blob = [
        r.titre,
        r.auteur,
        r.commentaire,
        r.personnes?.prenom,
        r.personnes?.nom,
        String(r.personnes?.famille_id ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  });

  readonly displayedColumns: string[] = [
    'select',
    'cover',
    'track',
    'guest',
    'famille',
    'status',
    'comment',
    'date',
    'actions',
  ];

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('musiques')
        .select(
          `
          id,
          created_at,
          titre,
          auteur,
          lien,
          commentaire,
          status,
          album_image_url,
          spotify_uri,
          spotify_track_id,
          personnes ( id, prenom, nom, famille_id )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      const raw = (data || []) as unknown[];
      const mapped: AdminMusiqueRow[] = raw.map((row: any) => ({
        id: Number(row.id),
        created_at: row.created_at,
        titre: row.titre ?? '',
        auteur: row.auteur ?? '',
        lien: row.lien ?? '',
        commentaire: row.commentaire ?? '',
        status: row.status,
        album_image_url: row.album_image_url ?? null,
        spotify_uri: row.spotify_uri ?? null,
        spotify_track_id: row.spotify_track_id ?? null,
        personnes: row.personnes
          ? {
              id: Number(row.personnes.id),
              prenom: row.personnes.prenom ?? '',
              nom: row.personnes.nom ?? '',
              famille_id: Number(row.personnes.famille_id),
            }
          : null,
      }));
      this.rows.set(mapped);
      this.selectedIds.set(new Set());
    } catch (e) {
      console.error('admin musiques load', e);
      this.rows.set([]);
      this.snackBar.open(
        'Impossible de charger les musiques. Vérifiez la connexion admin.',
        'OK',
        { duration: 5000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'approved':
        return 'Validé';
      case 'rejected':
        return 'Refusé';
      case 'pending':
      default:
        return 'En attente';
    }
  }

  setStatusFilter(v: MusiqueStatusFilter): void {
    this.statusFilter.set(v);
  }

  async updateStatus(row: AdminMusiqueRow, status: 'approved' | 'rejected'): Promise<void> {
    if (row.status === status) return;
    this.updatingId.set(row.id);
    try {
      const client = this.supabase.getClient();
      const { error } = await client.from('musiques').update({ status }).eq('id', row.id);
      if (error) throw error;
      this.rows.update((list) =>
        list.map((m) => (m.id === row.id ? { ...m, status } : m))
      );
      this.snackBar.open(
        status === 'approved' ? 'Proposition validée.' : 'Proposition refusée.',
        'OK',
        { duration: 3000 }
      );
    } catch (e) {
      console.error('update musique status', e);
      this.snackBar.open('Mise à jour impossible.', 'OK', { duration: 4000 });
    } finally {
      this.updatingId.set(null);
    }
  }

  formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('fr-BE', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  /** URI Spotify exploitable pour l’API playlist (liens manuels YouTube etc. exclus). */
  spotifyUriForRow(m: AdminMusiqueRow): string | null {
    const u = (m.spotify_uri || '').trim();
    if (u.startsWith('spotify:track:')) {
      return u;
    }
    const tid = (m.spotify_track_id || '').trim();
    if (tid) {
      return `spotify:track:${tid}`;
    }
    return null;
  }

  filteredRowsWithSpotify(): AdminMusiqueRow[] {
    return this.filteredRows().filter((r) => this.spotifyUriForRow(r) !== null);
  }

  isRowSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleRowSelect(id: number, checked: boolean): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  allFilteredSpotifySelected(): boolean {
    const spotifyRows = this.filteredRowsWithSpotify();
    if (spotifyRows.length === 0) {
      return false;
    }
    const sel = this.selectedIds();
    return spotifyRows.every((r) => sel.has(r.id));
  }

  toggleSelectAllFiltered(checked: boolean): void {
    const spotifyRows = this.filteredRowsWithSpotify();
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      for (const r of spotifyRows) {
        if (checked) {
          next.add(r.id);
        } else {
          next.delete(r.id);
        }
      }
      return next;
    });
  }

  async addSelectedToSpotifyPlaylist(): Promise<void> {
    const uris = this.selectedSpotifyUriList();
    if (uris.length === 0) {
      this.snackBar.open('Cochez au moins un titre issu de Spotify.', 'OK', { duration: 4000 });
      return;
    }

    const client = this.supabase.getClient();
    const { data: sessionData } = await client.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (!jwt) {
      this.snackBar.open('Session admin introuvable, reconnectez-vous.', 'OK', { duration: 5000 });
      return;
    }

    this.playlistBusy.set(true);
    const endpoint = this.resolveApiUrl('/api/spotify-playlist-add.php');
    let totalAdded = 0;
    try {
      for (let i = 0; i < uris.length; i += 100) {
        const batch = uris.slice(i, i + 100);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ uris: batch }),
          cache: 'no-store',
        });
        let payload: { ok?: boolean; added?: number; error?: string; hint?: string } | null = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (!res.ok) {
          const msg = payload?.error || `Erreur HTTP ${res.status}`;
          throw new Error(msg);
        }
        totalAdded += payload?.added ?? batch.length;
      }
      this.snackBar.open(
        `${totalAdded} titre(s) envoyé(s) vers la playlist Spotify.`,
        'OK',
        { duration: 5000 }
      );
      this.selectedIds.set(new Set());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('spotify-playlist-add', e);
      this.snackBar.open(msg, 'OK', { duration: 7000 });
    } finally {
      this.playlistBusy.set(false);
    }
  }

  private resolveApiUrl(path: string): string {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }
}
