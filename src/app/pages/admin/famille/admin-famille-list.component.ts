import { ChangeDetectionStrategy, Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSupabaseService } from '../../../services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-famille-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTableModule, MatChipsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDialogModule, MatSnackBarModule, MatFormFieldModule, MatInputModule],
  templateUrl: './admin-famille-list.component.html',
  styleUrls: ['./admin-famille-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFamilleListComponent implements OnInit {
  // signal contenant la liste des familles récupérées depuis Supabase
  familles = signal<any[]>([]);
  loading = signal(false);

  displayedColumns = ['name', 'persons', 'actions'];

  // simple client-side filter
  filter = signal('');
  filteredFamilles = computed(() => {
    const q = (this.filter() || '').toLowerCase().trim();
    if (!q) return this.familles();
    return this.familles().filter((f: any) => {
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

  // Fonction helper pour obtenir le nom d'affichage de la famille
  getFamilyDisplayName(famille: any): string {
    if (!famille) return 'Famille';
    
    const principaleId = famille.personne_principale;
    if (principaleId && Array.isArray(famille.personnes)) {
      const principale = famille.personnes.find((p: any) => p.id === principaleId);
      if (principale) {
        return `Famille ${principale.prenom} ${principale.nom}`;
      }
    }
    
    // Fallback : utiliser la première personne ou l'ID
    if (Array.isArray(famille.personnes) && famille.personnes.length > 0) {
      const first = famille.personnes[0];
      return `Famille ${first.prenom} ${first.nom}`;
    }
    
    return `Famille #${famille.id}`;
  }

  constructor(private ngSupabase: NgSupabaseService, private router: Router, private dialog: MatDialog, private snackBar: MatSnackBar) {}

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
      this.familles.set(rows as any[]);
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
    
    const ref = this.dialog.open(ConfirmDialogComponent, { 
      width: '400px',
      data: dialogData,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '200ms'
    });
    
    const closed = await firstValueFrom(ref.afterClosed());
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
    
    const ref = this.dialog.open(ConfirmDialogComponent, { 
      width: '450px',
      data: dialogData,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '200ms'
    });
    
    const closed = await firstValueFrom(ref.afterClosed());
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
}
