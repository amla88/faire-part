import { ChangeDetectionStrategy, Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialogService } from 'src/app/shared/dialogs/confirm-dialog/confirm-dialog.service';
import { ConfirmDialogData } from 'src/app/shared/dialogs/confirm-dialog/confirm-dialog.component';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router, RouterModule } from '@angular/router';
import { AvatarMacaronComponent } from 'src/app/shared/avatar-macaron/avatar-macaron.component';

@Component({
  selector: 'app-admin-famille-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTableModule, MatChipsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule, MatFormFieldModule, MatInputModule, MatTooltipModule, MatCheckboxModule, AvatarMacaronComponent],
  templateUrl: './admin-famille-list.component.html',
  styleUrls: ['./admin-famille-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFamilleListComponent implements OnInit {
  // signal contenant la liste des familles récupérées depuis Supabase
  familles = signal<any[]>([]);
  loading = signal(false);

  displayedColumns = ['name', 'persons', 'invitation_envoyee', 'actions'];

  // simple client-side filter
  filter = signal('');
  /** N'afficher que les familles dont l'invitation n'a pas encore été marquée comme envoyée */
  onlyNotSentInvitations = signal(false);

  filteredFamilles = computed(() => {
    let list = this.familles();
    if (this.onlyNotSentInvitations()) {
      list = list.filter((f: any) => !f.invitation_envoyee);
    }
    const q = (this.filter() || '').toLowerCase().trim();
    if (!q) return list;
    return list.filter((f: any) => {
      const familyName = this.getFamilyDisplayName(f);
      if (familyName.toLowerCase().includes(q)) return true;
      if ((f.id + '').includes(q)) return true;
      // check persons
      if (Array.isArray(f.personnes)) {
        for (const p of f.personnes) {
          const fullname = ((p.prenom || '') + ' ' + (p.nom || '')).toLowerCase();
          if (fullname.includes(q)) return true;
        }
      }
      return false;
    });
  });

  totalPersonnes = computed(() => {
    return this.filteredFamilles().reduce((acc, f) => acc + (f.personnes?.length || 0), 0);
  });

  // Fonction helper pour obtenir le nom d'affichage de la famille
  getFamilyDisplayName(famille: any): string {
    if (!famille) return 'Famille';

    const principale = this.getPersonnePrincipale(famille);
    if (principale) {
      return `Famille ${principale.prenom} ${principale.nom}`;
    }

    if (Array.isArray(famille.personnes) && famille.personnes.length > 0) {
      const first = famille.personnes[0];
      return `Famille ${first.prenom} ${first.nom}`;
    }

    return `Famille #${famille.id}`;
  }

  /** Personne principale pour affichage / tri (nom de famille pour le tri). */
  private getPersonnePrincipale(famille: any): any | null {
    if (!famille || !Array.isArray(famille.personnes)) return null;
    const principaleId = famille.personne_principale;
    if (principaleId != null) {
      const p = famille.personnes.find((x: any) => Number(x.id) === Number(principaleId));
      if (p) return p;
    }
    return famille.personnes[0] ?? null;
  }

  private sortKeyNomPrincipale(famille: any): string {
    const p = this.getPersonnePrincipale(famille);
    const raw = (p?.nom || '').trim();
    return raw.toLocaleLowerCase('fr');
  }

  private sortFamillesByPrincipalNom(rows: any[]): any[] {
    return [...rows].sort((a, b) => {
      const cmp = this.sortKeyNomPrincipale(a).localeCompare(this.sortKeyNomPrincipale(b), 'fr', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return Number(a.id) - Number(b.id);
    });
  }

  constructor(private ngSupabase: NgSupabaseService, private router: Router, private confirmDialog: ConfirmDialogService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadFamilles();
  }

  async loadFamilles() {
    this.loading.set(true);
    try {
      const client = this.ngSupabase.getClient();
      // On essaie de récupérer les familles avec leurs personnes associées
  // Préciser la relation pour éviter l'ambiguïté PGRST201
  // On veut les personnes liées via personnes.famille_id -> familles.id
  const res = await client.from('familles').select("*, personnes!personnes_famille_id_fkey(*)");
      if (res.error) throw res.error;
      // Normaliser la réponse
      const rows = Array.isArray(res.data) ? res.data : [];
      this.familles.set(this.sortFamillesByPrincipalNom(rows as any[]));
    } catch (err) {
      console.error('Erreur chargement familles', err);
      this.familles.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  goToDetails(famille: any) {
    // Navigue vers la page détail. Le routeur admin possède déjà 'famille' pour l'édition/ajout,
    // on envoie l'id en paramètre (à adapter selon routing souhaité)
    this.router.navigate(['admin', 'famille', famille.id]);
  }

  async deletePerson(familleId: number, personId: number) {
    const dialogData: ConfirmDialogData = {
      title: 'Supprimer la personne',
      message: 'Êtes-vous sûr de vouloir supprimer cette personne ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      isDanger: true
    };
    
    const closed = await this.confirmDialog.confirm(dialogData);
    if (!closed) return;
    try {
      const client = this.ngSupabase.getClient();
      const res = await client.from('personnes').delete().eq('id', personId);
      if (res.error) throw res.error;
      // refresh
      await this.loadFamilles();
    } catch (err) {
      console.error('Erreur suppression personne', err);
      this.snackBar.open('Erreur lors de la suppression de la personne', 'Fermer', { duration: 5000 });
    }
  }

  async deleteFamille(familleId: number) {
    const dialogData: ConfirmDialogData = {
      title: 'Supprimer la famille',
      message: 'Êtes-vous sûr de vouloir supprimer cette famille et toutes ses personnes ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      isDanger: true
    };
    
    const closed = await this.confirmDialog.confirm(dialogData);
    if (!closed) return;
    try {
      const client = this.ngSupabase.getClient();
      const res = await client.from('familles').delete().eq('id', familleId);
      if (res.error) throw res.error;
      // refresh
      await this.loadFamilles();
    } catch (err) {
      console.error('Erreur suppression famille', err);
      this.snackBar.open('Erreur lors de la suppression de la famille', 'Fermer', { duration: 5000 });
    }
  }

  async toggleInvite(person: any, inviteType: 'invite_reception' | 'invite_repas' | 'invite_soiree', familleId: number) {
    const newValue = !person[inviteType];
    const originalValue = person[inviteType];

    // Optimistic UI Update
    this.familles.update(currentFamilles =>
      currentFamilles.map(famille =>
        famille.id === familleId
          ? {
              ...famille,
              personnes: famille.personnes.map((p: any) =>
                p.id === person.id ? { ...p, [inviteType]: newValue } : p
              ),
            }
          : famille
      )
    );

    try {
      const { error } = await this.ngSupabase
        .getClient()
        .from('personnes')
        .update({ [inviteType]: newValue })
        .eq('id', person.id);

      if (error) throw error;
    } catch (err) {
      console.error('Erreur mise à jour invitation', err);
      this.snackBar.open("Erreur: Le statut n'a pas pu être mis à jour.", 'Fermer', { duration: 5000 });

      // Rollback UI on error
      this.familles.update(currentFamilles =>
        currentFamilles.map(famille =>
          famille.id === familleId
            ? {
                ...famille,
                personnes: famille.personnes.map((p: any) =>
                  p.id === person.id ? { ...p, [inviteType]: originalValue } : p
                ),
              }
            : famille
        )
      );
    }
  }

  async toggleInvitationEnvoyee(famille: any, checked: boolean) {
    const familleId = famille.id;
    const previous = !!famille.invitation_envoyee;

    this.familles.update((current) =>
      current.map((f) => (f.id === familleId ? { ...f, invitation_envoyee: checked } : f))
    );

    try {
      const { error } = await this.ngSupabase.getClient().from('familles').update({ invitation_envoyee: checked }).eq('id', familleId);
      if (error) throw error;
    } catch (err) {
      console.error('Erreur mise à jour invitation envoyée', err);
      this.snackBar.open("Erreur : le statut « invitation envoyée » n'a pas pu être enregistré.", 'Fermer', { duration: 5000 });
      this.familles.update((current) =>
        current.map((f) => (f.id === familleId ? { ...f, invitation_envoyee: previous } : f))
      );
    }
  }
}
