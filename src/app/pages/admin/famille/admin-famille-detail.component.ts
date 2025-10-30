import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
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

  // Computed pour obtenir le nom de la famille basé sur la personne principale
  familyDisplayName = computed(() => {
    const fam = this.famille();
    if (!fam) return 'Famille';
    
    const principaleId = fam.personne_principale;
    if (principaleId && Array.isArray(fam.personnes)) {
      const principale = fam.personnes.find((p: any) => p.id === principaleId);
      if (principale) {
        return `Famille ${principale.prenom} ${principale.nom}`;
      }
    }
    
    // Fallback : utiliser la première personne ou l'ID
    if (Array.isArray(fam.personnes) && fam.personnes.length > 0) {
      const first = fam.personnes[0];
      return `Famille ${first.prenom} ${first.nom}`;
    }
    
    return `Famille #${fam.id}`;
  });

  form = this.fb.group({
    // Supprimé le champ 'nom' car il n'existe pas dans la table familles
    // Le nom de la famille est dérivé de la personne principale
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

  constructor(
    private route: ActivatedRoute, 
    private ngSupabase: NgSupabaseService, 
    private dialog: MatDialog, 
    private snackBar: MatSnackBar, 
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id')) || null;
    if (id) this.loadFamille(id);
  }

  get persons(): FormArray {
    return this.form.get('persons') as FormArray;
  }

  createPersonGroup(data?: any): FormGroup {
    return this.fb.group({
      id: [data?.id || null],
      nom: [data?.nom || '', [Validators.required, Validators.maxLength(100)]],
      prenom: [data?.prenom || '', [Validators.required, Validators.maxLength(100)]],
      email: [data?.email || '', [Validators.email, Validators.maxLength(255)]],
      invite_reception: [!!data?.invite_reception],
      invite_repas: [!!data?.invite_repas],
      invite_soiree: [!!data?.invite_soiree],
    });
  }

  addPerson(data?: any) {
    const newPerson = this.createPersonGroup(data);
    this.persons.push(newPerson);
    
    // Si c'est la première personne et qu'aucune personne principale n'est définie,
    // définir automatiquement cette personne comme principale
    if (this.persons.length === 1 && !this.form.get('personne_principale')?.value && data?.id) {
      this.form.get('personne_principale')?.setValue(data.id);
    }
  }

  removePerson(index: number) {
    // Empêcher la suppression si c'est la dernière personne
    if (this.persons.length <= 1) {
      this.snackBar.open('Une famille doit contenir au moins une personne', 'Fermer', { duration: 5000 });
      return;
    }

    const g = this.persons.at(index) as FormGroup;
    const id = g.get('id')?.value;
    const currentPersonnePrincipale = this.form.get('personne_principale')?.value;
    
    // Si on supprime la personne principale, réinitialiser le champ
    if (id && id === currentPersonnePrincipale) {
      this.form.get('personne_principale')?.setValue(null);
    }
    
    if (id) this.deletedPersonIds.push(id);
    this.persons.removeAt(index);

    // Si après suppression il ne reste qu'une personne, la définir automatiquement comme principale
    if (this.persons.length === 1 && !this.form.get('personne_principale')?.value) {
      const remainingPersonId = this.persons.at(0).get('id')?.value;
      if (remainingPersonId) {
        this.form.get('personne_principale')?.setValue(remainingPersonId);
      }
    }
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
        // Supprimé le champ nom car il n'existe pas dans la table familles
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
        
        // Si aucune personne principale n'est définie mais qu'il y a des personnes,
        // définir automatiquement la première comme principale
        if (!data.personne_principale && data.personnes.length > 0) {
          const firstPersonId = data.personnes[0].id;
          if (firstPersonId) {
            this.form.get('personne_principale')?.setValue(firstPersonId);
          }
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
        // Supprimé le champ nom car il n'existe pas dans la table familles
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
    // Validation : au moins une personne doit être présente
    if (this.persons.length === 0) {
      this.snackBar.open('Une famille doit contenir au moins une personne', 'Fermer', { duration: 5000 });
      return;
    }

    // Validation des formulaires de personnes
    const invalidPersons = this.persons.controls.filter(ctrl => ctrl.invalid);
    if (invalidPersons.length > 0) {
      this.persons.controls.forEach(ctrl => ctrl.markAllAsTouched());
      this.snackBar.open('Veuillez corriger les erreurs dans les informations des personnes', 'Fermer', { duration: 5000 });
      return;
    }

    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      const familleId = this.famille()?.id;
      if (!familleId) throw new Error('ID famille manquant');

      const toUpsert = this.persons.controls.map((ctrl) => {
        const g = ctrl as FormGroup;
        const id = g.get('id')?.value;
        
        const personData: any = {
          nom: g.get('nom')?.value,
          prenom: g.get('prenom')?.value,
          email: g.get('email')?.value || null,
          invite_reception: !!g.get('invite_reception')?.value,
          invite_repas: !!g.get('invite_repas')?.value,
          invite_soiree: !!g.get('invite_soiree')?.value,
          famille_id: familleId,
        };
        
        // N'inclure l'ID que s'il existe (personne existante)
        if (id) {
          personData.id = id;
        }
        
        return personData;
      });

      // Séparer les nouvelles personnes des personnes existantes
      const existingPersons = toUpsert.filter(p => p.id);
      const newPersons = toUpsert.filter(p => !p.id);

      // Traiter les personnes existantes (mise à jour)
      if (existingPersons.length > 0) {
        const updateRes = await client.from('personnes').upsert(existingPersons, { onConflict: 'id' }).select();
        if (updateRes.error) throw updateRes.error;
      }

      // Traiter les nouvelles personnes (insertion)
      if (newPersons.length > 0) {
        const insertRes = await client.from('personnes').insert(newPersons).select();
        if (insertRes.error) throw insertRes.error;
      }

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

  async saveAll() {
    // Validation globale du formulaire
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Formulaire invalide', 'Fermer', { duration: 3000 });
      return;
    }

    // Validation : au moins une personne doit être présente
    if (this.persons.length === 0) {
      this.snackBar.open('Une famille doit contenir au moins une personne', 'Fermer', { duration: 5000 });
      return;
    }

    // Validation des formulaires de personnes
    const invalidPersons = this.persons.controls.filter(ctrl => ctrl.invalid);
    if (invalidPersons.length > 0) {
      this.persons.controls.forEach(ctrl => ctrl.markAllAsTouched());
      this.snackBar.open('Veuillez corriger les erreurs dans les informations des personnes', 'Fermer', { duration: 5000 });
      return;
    }

    // Sauvegarder d'abord les personnes, puis la famille
    try {
      await this.savePersons();
      await this.saveFamille();
      this.snackBar.open('Famille et personnes sauvegardées avec succès', 'Fermer', { duration: 3000 });
    } catch (err) {
      console.error('Erreur lors de la sauvegarde complète', err);
      this.snackBar.open('Erreur lors de la sauvegarde complète', 'Fermer', { duration: 5000 });
    }
  }
}
