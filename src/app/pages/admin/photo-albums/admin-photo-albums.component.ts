import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AdminAuthService } from 'src/app/services/admin-auth.service';
import { AdminPhotoAlbumsService } from 'src/app/services/admin-photo-albums.service';
import type { FamilyPhoto } from 'src/app/services/photo.service';

export type AdminAlbumSortMode = 'modified' | 'alpha';

export interface AdminFamilleAlbumGroup {
  familleId: number;
  familleLabel: string;
  principalNom: string;
  principalPrenom: string;
  albumLastModified: string | null;
  albumLastModifiedTs: number;
  personnes: Array<{
    personneId: number;
    prenom: string;
    nom: string;
    items: FamilyPhoto[];
  }>;
}

@Component({
  selector: 'app-admin-photo-albums',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
  ],
  templateUrl: './admin-photo-albums.component.html',
  styleUrls: ['./admin-photo-albums.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPhotoAlbumsComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly albumsApi = inject(AdminPhotoAlbumsService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sortMode = signal<AdminAlbumSortMode>('modified');
  readonly famillesRaw = signal<any[]>([]);
  readonly albumsByPersonneId = signal<Map<number, FamilyPhoto[]>>(new Map());

  readonly displayGroups = computed(() => {
    const mode = this.sortMode();
    const fams = this.famillesRaw();
    const map = this.albumsByPersonneId();
    const groups: AdminFamilleAlbumGroup[] = [];

    for (const f of fams) {
      const personnes = (f.personnes || [])
        .map((p: any) => ({
          personneId: Number(p.id),
          prenom: String(p.prenom ?? '').trim(),
          nom: String(p.nom ?? '').trim(),
          items: map.get(Number(p.id)) ?? [],
        }))
        .filter((x: { items: FamilyPhoto[] }) => x.items.length > 0);

      if (personnes.length === 0) continue;

      const principale = this.getPersonnePrincipale(f);
      const principalNom = String(principale?.nom ?? '').trim();
      const principalPrenom = String(principale?.prenom ?? '').trim();
      const familleLabel = principale
        ? `Famille ${[principalPrenom, principalNom].filter(Boolean).join(' ')}`.trim()
        : `Famille #${f.id}`;

      let maxTs = 0;
      let maxIso: string | null = null;
      for (const sub of personnes) {
        for (const ph of sub.items) {
          const t = ph.lastModified ? new Date(ph.lastModified).getTime() : 0;
          if (t >= maxTs) {
            maxTs = t;
            maxIso = ph.lastModified;
          }
        }
      }

      groups.push({
        familleId: Number(f.id),
        familleLabel,
        principalNom,
        principalPrenom,
        albumLastModified: maxIso,
        albumLastModifiedTs: maxTs,
        personnes,
      });
    }

    const sorted = [...groups];
    if (mode === 'alpha') {
      sorted.sort((a, b) => {
        const c = a.principalNom.localeCompare(b.principalNom, 'fr', { sensitivity: 'base' });
        if (c !== 0) return c;
        const c2 = a.principalPrenom.localeCompare(b.principalPrenom, 'fr', { sensitivity: 'base' });
        if (c2 !== 0) return c2;
        return a.familleId - b.familleId;
      });
    } else {
      sorted.sort((a, b) => b.albumLastModifiedTs - a.albumLastModifiedTs || a.familleId - b.familleId);
    }

    return sorted;
  });

  readonly totalPhotos = computed(() => {
    let n = 0;
    for (const g of this.displayGroups()) {
      for (const p of g.personnes) {
        n += p.items.length;
      }
    }
    return n;
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.adminAuth.initialized;
      const session = this.adminAuth.session();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Session admin introuvable.');
      }

      const client = this.supabase.getClient();
      const res = await client.from('familles').select('*, personnes!personnes_famille_id_fkey(*)');
      if (res.error) throw res.error;
      const rows = Array.isArray(res.data) ? res.data : [];
      this.famillesRaw.set(rows as any[]);

      const ids: number[] = [];
      for (const f of rows as any[]) {
        for (const p of f.personnes || []) {
          const id = Number(p.id);
          if (Number.isFinite(id)) ids.push(id);
        }
      }

      const map = await this.albumsApi.fetchAlbumsForPersonnes(token, ids);
      this.albumsByPersonneId.set(map);
    } catch (e: any) {
      this.error.set(e?.message || String(e));
      this.famillesRaw.set([]);
      this.albumsByPersonneId.set(new Map());
    } finally {
      this.loading.set(false);
    }
  }

  setSortMode(v: AdminAlbumSortMode | string): void {
    if (v === 'modified' || v === 'alpha') {
      this.sortMode.set(v);
    }
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return this.dateFormatter.format(d);
  }

  formatSize(value: number): string {
    if (!value) return '0 o';
    const kilo = value / 1024;
    if (kilo < 1024) return `${kilo.toFixed(1)} Ko`;
    const mega = kilo / 1024;
    if (mega < 1024) return `${mega.toFixed(1)} Mo`;
    return `${(mega / 1024).toFixed(2)} Go`;
  }

  private getPersonnePrincipale(famille: any): any | null {
    if (!famille || !Array.isArray(famille.personnes)) return null;
    const principaleId = famille.personne_principale;
    if (principaleId != null) {
      const p = famille.personnes.find((x: any) => Number(x.id) === Number(principaleId));
      if (p) return p;
    }
    return famille.personnes[0] ?? null;
  }
}
