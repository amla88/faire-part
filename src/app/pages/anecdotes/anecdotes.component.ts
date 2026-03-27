import {
  ChangeDetectionStrategy,
  Component,
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
import { TextFieldModule } from '@angular/cdk/text-field';
import { AuthService, PersonneSummary } from 'src/app/services/auth.service';
import { AnecdoteService, PersonneAnecdote } from 'src/app/services/anecdote.service';

@Component({
  selector: 'app-anecdotes',
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
    TextFieldModule,
  ],
  templateUrl: './anecdotes.component.html',
  styleUrls: ['./anecdotes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnecdotesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private anecdoteService = inject(AnecdoteService);
  private snack = inject(MatSnackBar);

  readonly maxLen = 8000;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly anecdotes = signal<PersonneAnecdote[]>([]);
  readonly selectedPersonneId = signal<number | null>(null);
  readonly selectedPersonneLabel = signal<string>('');

  form = this.fb.nonNullable.group({
    contenu: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(this.maxLen)]],
  });

  private readonly dateFmt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  ngOnInit(): void {
    this.syncSelection();
    void this.load();
  }

  private syncSelection(): void {
    const user = this.auth.getUser();
    const pid = user?.selected_personne_id != null ? Number(user.selected_personne_id) : null;
    if (pid != null && Number.isFinite(pid)) {
      this.selectedPersonneId.set(pid);
      const p = user?.personnes?.find((x: PersonneSummary) => Number(x.id) === pid);
      this.selectedPersonneLabel.set(
        p ? `${p.prenom} ${p.nom}`.trim() : 'Cette personne'
      );
    } else {
      this.selectedPersonneId.set(null);
      this.selectedPersonneLabel.set('');
    }
  }

  async load(): Promise<void> {
    const pid = this.selectedPersonneId();
    if (pid == null) {
      this.anecdotes.set([]);
      return;
    }
    this.loading.set(true);
    try {
      const rows = await this.anecdoteService.listForPersonne(pid);
      this.anecdotes.set(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chargement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
      this.anecdotes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const pid = this.selectedPersonneId();
    if (pid == null) return;
    const raw = this.form.controls.contenu.value?.trim() ?? '';
    if (!raw) return;

    this.saving.set(true);
    try {
      const id = await this.anecdoteService.insert(pid, raw);
      if (id != null) {
        this.form.reset();
        this.snack.open('Anecdote enregistrée', undefined, { duration: 2500 });
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
      const ok = await this.anecdoteService.delete(id);
      if (ok) {
        this.snack.open('Anecdote supprimée', undefined, { duration: 2000 });
        await this.load();
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

  get canSubmit(): boolean {
    return (
      this.selectedPersonneId() != null &&
      this.form.valid &&
      !this.saving() &&
      !this.loading()
    );
  }
}
