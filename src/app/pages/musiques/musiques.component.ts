import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  from,
  takeUntil,
  map,
  catchError,
  of,
} from 'rxjs';
import { AuthService, PersonneSummary } from 'src/app/services/auth.service';
import { ManualTrackInput, MusiqueService, MusiqueRow, SpotifySearchTrack } from 'src/app/services/musique.service';

@Component({
  selector: 'app-musiques',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  templateUrl: './musiques.component.html',
  styleUrls: ['./musiques.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MusiquesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private musiqueService = inject(MusiqueService);
  private snack = inject(MatSnackBar);

  readonly maxProposals = 3;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchLoading = signal(false);
  readonly rows = signal<MusiqueRow[]>([]);
  readonly searchHits = signal<SpotifySearchTrack[]>([]);
  readonly selectedPersonneId = signal<number | null>(null);
  readonly selectedPersonneLabel = signal<string>('');
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  searchForm = this.fb.nonNullable.group({
    q: ['', [Validators.maxLength(200)]],
  });

  commentForm = this.fb.nonNullable.group({
    note: ['', [Validators.maxLength(500)]],
  });

  manualForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    artist: ['', [Validators.required, Validators.maxLength(200)]],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i), Validators.maxLength(500)]],
  });

  private readonly dateFmt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  ngOnInit(): void {
    this.syncSelection();
    void this.load();

    this.search$
      .pipe(
        debounceTime(350),
        map((q: string) => q.trim()),
        distinctUntilChanged(),
        filter((q: string) => q.length >= 2),
        switchMap((q: string) => {
          this.searchLoading.set(true);
          return from(
            this.musiqueService.searchSpotify(q).finally(() => this.searchLoading.set(false))
          ).pipe(
            // Ne pas terminer l’abonnement sur erreur HTTP : l’utilisateur peut retaper une recherche.
            catchError((err: unknown) => {
              const msg = err instanceof Error ? err.message : 'Recherche impossible';
              this.snack.open(msg, 'OK', { duration: 6000 });
              return of([] as SpotifySearchTrack[]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (tracks) => this.searchHits.set(tracks),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncSelection(): void {
    const user = this.auth.getUser();
    const pid = user?.selected_personne_id != null ? Number(user.selected_personne_id) : null;
    if (pid != null && Number.isFinite(pid)) {
      this.selectedPersonneId.set(pid);
      const p = user?.personnes?.find((x: PersonneSummary) => Number(x.id) === pid);
      this.selectedPersonneLabel.set(p ? `${p.prenom} ${p.nom}`.trim() : 'Cette personne');
    } else {
      this.selectedPersonneId.set(null);
      this.selectedPersonneLabel.set('');
    }
  }

  onSearchInput(): void {
    const q = this.searchForm.controls.q.value ?? '';
    const t = q.trim();
    if (t.length < 2) {
      this.searchHits.set([]);
      this.searchLoading.set(false);
      return;
    }
    this.search$.next(q);
  }

  async load(): Promise<void> {
    const pid = this.selectedPersonneId();
    if (pid == null) {
      this.rows.set([]);
      return;
    }
    this.loading.set(true);
    try {
      const list = await this.musiqueService.listForPersonne(pid);
      this.rows.set(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chargement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async addTrack(track: SpotifySearchTrack): Promise<void> {
    const pid = this.selectedPersonneId();
    if (pid == null) return;
    if (this.rows().length >= this.maxProposals) return;

    this.saving.set(true);
    try {
      const note = this.commentForm.controls.note.value?.trim() ?? '';
      const id = await this.musiqueService.insert(pid, track, note);
      if (id != null) {
        this.snack.open('Proposition enregistrée', undefined, { duration: 2500 });
        this.commentForm.patchValue({ note: '' });
        await this.load();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Enregistrement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  async addManualTrack(): Promise<void> {
    const pid = this.selectedPersonneId();
    if (pid == null) return;
    if (this.rows().length >= this.maxProposals) return;
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const note = this.commentForm.controls.note.value?.trim() ?? '';
      const payload: ManualTrackInput = {
        title: this.manualForm.controls.title.value.trim(),
        artist: this.manualForm.controls.artist.value.trim(),
        url: this.manualForm.controls.url.value.trim(),
        comment: note,
      };
      const id = await this.musiqueService.insertManual(pid, payload);
      if (id != null) {
        this.snack.open('Proposition enregistrée', undefined, { duration: 2500 });
        this.commentForm.patchValue({ note: '' });
        this.manualForm.reset();
        await this.load();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Enregistrement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: number): Promise<void> {
    this.saving.set(true);
    try {
      const ok = await this.musiqueService.delete(id);
      if (ok) {
        this.snack.open('Proposition retirée', undefined, { duration: 2000 });
        await this.load();
      } else {
        this.snack.open('Suppression impossible (statut ou droits)', 'OK', { duration: 4000 });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Suppression impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return this.dateFmt.format(d);
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return '';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
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

  linkLabel(url: string): string {
    const raw = (url || '').toLowerCase();
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = raw;
    }
    if (host.includes('spotify.')) return 'Ouvrir sur Spotify';
    if (host.includes('youtube.') || host.includes('youtu.be')) return 'Ouvrir sur YouTube';
    if (host.includes('deezer.')) return 'Ouvrir sur Deezer';
    if (host.includes('music.apple.') || host.includes('itunes.apple.')) return 'Ouvrir sur Apple Music';
    if (host.includes('soundcloud.')) return 'Ouvrir sur SoundCloud';
    return 'Ouvrir le lien';
  }

  get canAddMore(): boolean {
    return this.selectedPersonneId() != null && this.rows().length < this.maxProposals && !this.saving();
  }
}
