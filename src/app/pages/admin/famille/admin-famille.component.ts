import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { NgSupabaseService } from '../../../services/ng-supabase.service';
// Angular Material imports used in the template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-admin-famille',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './admin-famille.component.html',
  styleUrls: ['./admin-famille.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFamilleComponent {
  // Pays: liste simple pour remplir le select (à adapter si vous avez un provider central)
  countries = [
    { value: 'France', viewValue: 'France' },
    { value: 'Belgique', viewValue: 'Belgique' },
    { value: 'Suisse', viewValue: 'Suisse' },
    { value: 'England', viewValue: 'Angleterre' },
    { value: 'Spain', viewValue: 'Espagne' },
    { value: 'Italy', viewValue: 'Italie' },

  ];

  form = this.fb.group({
    // Supprimé le champ nom car il n'existe pas dans la table familles
    // Le nom de la famille sera dérivé de la personne principale
    rue: [''],
    numero: [''],
    boite: [''],
    cp: [''],
    ville: [''],
    pays: ['Belgique'],
    // persons: FormArray of FormGroup { nom, prenom, email, invite_reception, invite_repas, invite_soiree }
    persons: this.fb.array([this.createPersonGroup()]),
  });
  loading = false;
  message = '';

  constructor(private fb: FormBuilder, private ngSupabase: NgSupabaseService, private snackBar: MatSnackBar) {}

  // Helpers pour le FormArray
  createPersonGroup(): FormGroup {
    return this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.email]],
      // three booleans replacing the former enum invite_pour
      invite_reception: [true],
      invite_repas: [true],
      invite_soiree: [true],
    });
  }

  get persons(): FormArray {
    return this.form.get('persons') as FormArray;
  }

  addPerson() {
    this.persons.push(this.createPersonGroup());
  }

  removePerson(index: number) {
    if (this.persons.length <= 1) return; // garder au moins 1 personne
    this.persons.removeAt(index);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    try {
      const client = this.ngSupabase.getClient();

      // Préparer le payload famille
      const famillePayload: any = {
        personne_principale: null, // sera mis à jour après insertion des personnes
        rue: this.form.value.rue || null,
        numero: this.form.value.numero || null,
        boite: this.form.value.boite || null,
        cp: this.form.value.cp || null,
        ville: this.form.value.ville || null,
        pays: this.form.value.pays || null,
        // ajouter d'autres colonnes si nécessaire
      };

      // On insère la famille
      const insertFam = await client.from('familles').insert(famillePayload).select('id');
      if (insertFam.error) throw insertFam.error;
      const familleId = insertFam.data?.[0]?.id;
      if (!familleId) throw new Error('Impossible de récupérer l\'id de la famille');

      // Préparer et insérer les personnes liées
      const personsPayload = this.persons.controls.map((ctrl) => {
        const g = ctrl as FormGroup;
        return {
          nom: g.value.nom,
          prenom: g.value.prenom,
          email: g.value.email || null,
          invite_reception: !!g.value.invite_reception,
          invite_repas: !!g.value.invite_repas,
          invite_soiree: !!g.value.invite_soiree,
          famille_id: familleId,
        };
      });

      const insertPersons = await client.from('personnes').insert(personsPayload).select('id');
      if (insertPersons.error) throw insertPersons.error;
      const firstPersonId = insertPersons.data?.[0]?.id;

      // Mettre à jour la famille avec la personne_principale (première personne)
      if (firstPersonId) {
        const upd = await client.from('familles').update({ personne_principale: firstPersonId }).eq('id', familleId);
        if (upd.error) throw upd.error;
      }

      this.message = 'Famille et personnes ajoutées.';
      // SnackBar confirmation
      try {
        this.snackBar.open('Famille et personnes ajoutées.', 'Fermer', { duration: 4000 });
      } catch (e) {
        // ignore if snackBar cannot open in some environments
      }
      this.form.reset();
      // réinitialiser persons avec une personne principale vide
      this.form.setControl('persons', this.fb.array([this.createPersonGroup()]));
    } catch (err: any) {
      console.error(err);
      this.message = 'Erreur lors de l\'insertion : ' + (err?.message ?? err);
      try {
        this.snackBar.open('Erreur lors de l\'insertion : ' + (err?.message ?? ''), 'Fermer', { duration: 6000 });
      } catch (e) {
        // ignore
      }
    } finally {
      this.loading = false;
    }
  }
}
