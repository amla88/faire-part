import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

export interface AdminIdeeRow {
  id: number;
  personne_id: number;
  prenom: string;
  nom: string;
  famille_id: number;
  contenu: string;
  created_at: string;
}

@Component({
  selector: 'app-admin-boite-idees',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
  ],
  templateUrl: './admin-boite-idees.component.html',
  styleUrls: ['./admin-boite-idees.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBoiteIdeesComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<AdminIdeeRow[]>([]);
  readonly filterText = signal('');

  readonly loadingAnecdotes = signal(false);
  readonly errorAnecdotes = signal<string | null>(null);
  readonly rowsAnecdotes = signal<AdminIdeeRow[]>([]);
  readonly filterTextAnecdotes = signal('');

  readonly displayedColumns: string[] = ['created_at', 'auteur', 'famille', 'contenu'];

  readonly filteredRows = computed(() => {
    const q = (this.filterText() || '').toLowerCase().trim();
    const list = this.rows();
    if (!q) return list;
    return list.filter((r) => {
      const blob = `${r.prenom} ${r.nom} ${r.contenu} ${r.famille_id}`.toLowerCase();
      return blob.includes(q);
    });
  });

  readonly filteredRowsAnecdotes = computed(() => {
    const q = (this.filterTextAnecdotes() || '').toLowerCase().trim();
    const list = this.rowsAnecdotes();
    if (!q) return list;
    return list.filter((r) => {
      const blob = `${r.prenom} ${r.nom} ${r.contenu} ${r.famille_id}`.toLowerCase();
      return blob.includes(q);
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  private scrollToAnecdotesIfRouted(): void {
    if (!this.router.url.includes('/admin/anecdotes')) return;
    setTimeout(() => {
      document.getElementById('admin-section-anecdotes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadingAnecdotes.set(true);
    this.error.set(null);
    this.errorAnecdotes.set(null);
    try {
      const client = this.supabase.getClient();
      const [ideesRes, anecdotesRes] = await Promise.all([
        client.rpc('admin_list_all_idees'),
        client.rpc('admin_list_all_anecdotes'),
      ]);

      if (ideesRes.error) {
        console.error('[AdminBoiteIdees] idees', ideesRes.error);
        this.rows.set([]);
        this.error.set(ideesRes.error.message || 'Impossible de charger les idées.');
      } else {
        this.error.set(null);
        const rawI = Array.isArray(ideesRes.data) ? ideesRes.data : [];
        this.rows.set(
          rawI.map((r: any) => ({
            id: Number(r.id),
            personne_id: Number(r.personne_id),
            prenom: String(r.prenom ?? ''),
            nom: String(r.nom ?? ''),
            famille_id: Number(r.famille_id),
            contenu: String(r.contenu ?? ''),
            created_at: String(r.created_at ?? ''),
          })),
        );
      }

      if (anecdotesRes.error) {
        console.error('[AdminBoiteIdees] anecdotes', anecdotesRes.error);
        this.rowsAnecdotes.set([]);
        this.errorAnecdotes.set(anecdotesRes.error.message || 'Impossible de charger les anecdotes.');
      } else {
        this.errorAnecdotes.set(null);
        const rawA = Array.isArray(anecdotesRes.data) ? anecdotesRes.data : [];
        this.rowsAnecdotes.set(
          rawA.map((r: any) => ({
            id: Number(r.id),
            personne_id: Number(r.personne_id),
            prenom: String(r.prenom ?? ''),
            nom: String(r.nom ?? ''),
            famille_id: Number(r.famille_id),
            contenu: String(r.contenu ?? ''),
            created_at: String(r.created_at ?? ''),
          })),
        );
      }
    } catch (e: any) {
      console.error('[AdminBoiteIdees] load', e);
      this.rows.set([]);
      this.rowsAnecdotes.set([]);
      const msg = e?.message || 'Impossible de charger les données.';
      this.error.set(msg);
      this.errorAnecdotes.set(msg);
    } finally {
      this.loading.set(false);
      this.loadingAnecdotes.set(false);
      this.scrollToAnecdotesIfRouted();
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  trackById(_: number, row: AdminIdeeRow): number {
    return row.id;
  }

  trackByAnecdoteId(_: number, row: AdminIdeeRow): number {
    return row.id;
  }
}
