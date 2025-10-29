import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgSupabaseService } from '../../../services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  selector: 'app-admin-famille-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-famille-detail.component.html',
  styleUrls: ['./admin-famille-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFamilleDetailComponent implements OnInit {
  famille = signal<any | null>(null);
  loading = signal(false);

  // removed duplicate constructor; real constructor with FormBuilder is declared below

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id')) || null;
    if (id) this.loadFamille(id);
  }
  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    rue: [''],
    numero: [''],
    boite: [''],
    cp: [''],
    ville: [''],
    pays: [''],
    personne_principale: [null],
    persons: this.fb.array([]),
  });

  private deletedPersonIds: number[] = [];

  countries = [
    { value: 'France', viewValue: 'France' },
    { value: 'Belgique', viewValue: 'Belgique' },
    { value: 'Suisse', viewValue: 'Suisse' },
    { value: 'England', viewValue: 'Angleterre' },
    { value: 'Spain', viewValue: 'Espagne' },
    { value: 'Italy', viewValue: 'Italie' },
  ];

  constructor(private route: ActivatedRoute, private ngSupabase: NgSupabaseService, private dialog: MatDialog, private snackBar: MatSnackBar, private fb: FormBuilder) {}

  get persons(): FormArray {
    return this.form.get('persons') as FormArray;
  }

  createPersonGroup(data?: any): FormGroup {
    return this.fb.group({
      id: [data?.id || null],
      nom: [data?.nom || '', Validators.required],
      prenom: [data?.prenom || '', Validators.required],
      email: [data?.email || '', Validators.email],
      invite_reception: [!!data?.invite_reception],
      invite_repas: [!!data?.invite_repas],
      invite_soiree: [!!data?.invite_soiree],
    });
  }

  addPerson(data?: any) {
    this.persons.push(this.createPersonGroup(data));
  }

  removePerson(index: number) {
    const g = this.persons.at(index) as FormGroup;
    const id = g.get('id')?.value;
    if (id) this.deletedPersonIds.push(id);
    this.persons.removeAt(index);
  }

  async loadFamille(id: number) {
    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      const res = await client.from('familles').select("*, personnes!personnes_famille_id_fkey(*)").eq('id', id).single();
      if (res.error) throw res.error;
      const data = res.data as any;
      this.famille.set(data);

      this.form.patchValue({
        name: data.name || data.nom || '',
        rue: data.rue || '',
        numero: data.numero || '',
        boite: data.boite || '',
        cp: data.cp || '',
        ville: data.ville || '',
        pays: data.pays || 'Belgique',
        personne_principale: data.personne_principale || null,
      });

      this.persons.clear();
      if (Array.isArray(data.personnes)) {
        for (const p of data.personnes) {
          this.addPerson(p);
        }
      }
    } catch (err) {
      console.error('Erreur chargement famille', err);
      this.famille.set(null);
      this.snackBar.open('Erreur chargement famille', 'Fermer', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async saveFamille() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Formulaire invalide', 'Fermer', { duration: 3000 });
      return;
    }
    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      const familleId = this.famille()?.id;
      if (!familleId) throw new Error('ID famille manquant');

      const payload: any = {
        name: this.form.value.name || null,
        rue: this.form.value.rue || null,
        numero: this.form.value.numero || null,
        boite: this.form.value.boite || null,
        cp: this.form.value.cp || null,
        ville: this.form.value.ville || null,
        pays: this.form.value.pays || null,
        personne_principale: this.form.value.personne_principale || null,
      };

      const res = await client.from('familles').update(payload).eq('id', familleId);
      if (res.error) throw res.error;
      this.snackBar.open('Famille mise à jour', 'Fermer', { duration: 3000 });
      await this.loadFamille(familleId);
    } catch (err) {
      console.error('Erreur update famille', err);
      this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async savePersons() {
    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      const familleId = this.famille()?.id;
      if (!familleId) throw new Error('ID famille manquant');

      const toUpsert = this.persons.controls.map((ctrl) => {
        const g = ctrl as FormGroup;
        return {
          id: g.get('id')?.value || undefined,
          nom: g.get('nom')?.value,
          prenom: g.get('prenom')?.value,
          email: g.get('email')?.value || null,
          invite_reception: !!g.get('invite_reception')?.value,
          invite_repas: !!g.get('invite_repas')?.value,
          invite_soiree: !!g.get('invite_soiree')?.value,
          famille_id: familleId,
        };
      });

      const insertRes = await client.from('personnes').upsert(toUpsert, { onConflict: 'id' }).select();
      if (insertRes.error) throw insertRes.error;

      if (this.deletedPersonIds.length > 0) {
        const del = await client.from('personnes').delete().in('id', this.deletedPersonIds);
        if (del.error) throw del.error;
        this.deletedPersonIds = [];
      }

      this.snackBar.open('Personnes sauvegardées', 'Fermer', { duration: 3000 });
      await this.loadFamille(familleId);
    } catch (err) {
      console.error('Erreur save persons', err);
      this.snackBar.open('Erreur lors de la sauvegarde des personnes', 'Fermer', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  

  async deletePerson(personId: number) {
    const ref = this.dialog.open(ConfirmDialogComponent, { data: { title: 'Supprimer la personne', message: 'Supprimer cette personne ? Cette action est irréversible.' } });
    const closed = await firstValueFrom(ref.afterClosed());
    if (!closed) return;
    try {
      const client = this.ngSupabase.getClient();
      const res = await client.from('personnes').delete().eq('id', personId);
      if (res.error) throw res.error;
      // reload famille
      const id = Number(this.route.snapshot.paramMap.get('id')) || null;
      if (id) await this.loadFamille(id);
      this.snackBar.open('Personne supprimée', 'Fermer', { duration: 4000 });
    } catch (err) {
      console.error('Erreur suppression personne', err);
      this.snackBar.open('Erreur lors de la suppression de la personne', 'Fermer', { duration: 5000 });
    }
  }
}
