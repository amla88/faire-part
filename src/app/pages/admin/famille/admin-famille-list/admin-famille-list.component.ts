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
import { jsPDF } from 'jspdf';

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

  private sortKeyPrenomPrincipale(famille: any): string {
    const p = this.getPersonnePrincipale(famille);
    const raw = (p?.prenom || '').trim();
    return raw.toLocaleLowerCase('fr');
  }

  private sortFamillesByPrincipalNom(rows: any[]): any[] {
    return [...rows].sort((a, b) => {
      const cmp = this.sortKeyNomPrincipale(a).localeCompare(this.sortKeyNomPrincipale(b), 'fr', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      const cmpPrenom = this.sortKeyPrenomPrincipale(a).localeCompare(this.sortKeyPrenomPrincipale(b), 'fr', { sensitivity: 'base' });
      if (cmpPrenom !== 0) return cmpPrenom;
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

  private formatAdresseFamille(famille: any): string {
    if (!famille) return '';
    const rue = String(famille.rue ?? '').trim();
    const numero = String(famille.numero ?? '').trim();
    const boite = String(famille.boite ?? '').trim();
    const cp = String(famille.cp ?? '').trim();
    const ville = String(famille.ville ?? '').trim();
    const pays = String(famille.pays ?? '').trim();

    const line1Parts = [rue, numero].filter(Boolean);
    const line1 = line1Parts.join(' ').trim();
    const line1WithBoite = [line1, boite ? `boîte ${boite}` : ''].filter(Boolean).join(', ').trim();

    const line2 = [cp, ville].filter(Boolean).join(' ').trim();
    const lines = [line1WithBoite, line2, pays].filter((x) => x && x.length > 0);
    return lines.join('\n');
  }

  private formatMembresFamille(famille: any): string {
    const personnes = Array.isArray(famille?.personnes) ? famille.personnes : [];
    return personnes
      .map((p: any) => `${String(p?.prenom ?? '').trim()} ${String(p?.nom ?? '').trim()}`.trim())
      .filter((x: string) => x.length > 0)
      .join('\n');
  }

  exportAdressesPdf(): void {
    try {
      const familles = this.sortFamillesByPrincipalNom(this.filteredFamilles());
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 12;
      const marginY = 14;
      const bottomSafe = 14;

      const tableX = marginX;
      const tableW = pageW - marginX * 2;

      // Column widths (mm)
      const colSent = 10; // checkbox
      const colFamille = 38;
      const colMembres = 60;
      const colAdresse = tableW - (colSent + colFamille + colMembres);

      const headerH = 9;
      const cellPadX = 2;
      const cellPadY = 2.2;
      const lineH = 4.4;

      const drawHeader = (y: number): number => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Export adresses', tableX, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(new Date().toLocaleDateString('fr-FR'), pageW - marginX, y, { align: 'right' });
        y += 6;

        pdf.setDrawColor(40);
        pdf.setLineWidth(0.2);
        pdf.setFillColor(245, 245, 245);
        pdf.rect(tableX, y, tableW, headerH, 'FD');

        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);

        const yText = y + 6.2;
        let x = tableX;
        pdf.text('Env.', x + 2, yText);
        x += colSent;
        pdf.text('Famille', x + cellPadX, yText);
        x += colFamille;
        pdf.text('Membres', x + cellPadX, yText);
        x += colMembres;
        pdf.text('Adresse', x + cellPadX, yText);

        return y + headerH;
      };

      const drawRow = (y: number, f: any): number => {
        const familleLabel = this.getFamilyDisplayName(f);
        const membres = this.formatMembresFamille(f);
        const adresse = this.formatAdresseFamille(f);
        const sent = !!f?.invitation_envoyee;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.2);
        pdf.setTextColor(0);

        const familleLines = pdf.splitTextToSize(familleLabel || '', colFamille - 2 * cellPadX) as string[];
        const membresLines = pdf.splitTextToSize(membres || '', colMembres - 2 * cellPadX) as string[];
        const adresseLines = pdf.splitTextToSize(adresse || '', colAdresse - 2 * cellPadX) as string[];

        const linesCount = Math.max(1, familleLines.length, membresLines.length, adresseLines.length);
        const rowH = cellPadY * 2 + linesCount * lineH;

        // row background + borders
        pdf.setDrawColor(120);
        pdf.setLineWidth(0.1);
        pdf.rect(tableX, y, tableW, rowH, 'S');

        // vertical separators
        let x = tableX + colSent;
        pdf.line(x, y, x, y + rowH);
        x += colFamille;
        pdf.line(x, y, x, y + rowH);
        x += colMembres;
        pdf.line(x, y, x, y + rowH);

        // checkbox
        const cbSize = 4.2;
        const cbX = tableX + (colSent - cbSize) / 2;
        const cbY = y + (rowH - cbSize) / 2;
        pdf.rect(cbX, cbY, cbSize, cbSize, 'S');
        if (sent) {
          pdf.setLineWidth(0.4);
          pdf.line(cbX + 0.8, cbY + 0.8, cbX + cbSize - 0.8, cbY + cbSize - 0.8);
          pdf.line(cbX + cbSize - 0.8, cbY + 0.8, cbX + 0.8, cbY + cbSize - 0.8);
          pdf.setLineWidth(0.1);
        }

        // text cells
        const baseY = y + cellPadY + 3.2; // baseline tweak
        // famille
        let tx = tableX + colSent + cellPadX;
        for (let i = 0; i < familleLines.length; i++) {
          pdf.text(familleLines[i], tx, baseY + i * lineH);
        }
        // membres
        tx += colFamille;
        for (let i = 0; i < membresLines.length; i++) {
          pdf.text(membresLines[i], tx, baseY + i * lineH);
        }
        // adresse
        tx += colMembres;
        for (let i = 0; i < adresseLines.length; i++) {
          pdf.text(adresseLines[i], tx, baseY + i * lineH);
        }

        return y + rowH;
      };

      let y = marginY;
      y = drawHeader(y);

      for (const f of familles) {
        const neededSpaceEstimate = 14; // minimum row size + breathing room
        if (y + neededSpaceEstimate > pageH - bottomSafe) {
          pdf.addPage('a4', 'portrait');
          y = marginY;
          y = drawHeader(y);
        }
        const yAfter = drawRow(y, f);
        if (yAfter > pageH - bottomSafe) {
          // If it overflowed due to long wrapped cells, re-render row on next page.
          pdf.addPage('a4', 'portrait');
          y = marginY;
          y = drawHeader(y);
          y = drawRow(y, f);
        } else {
          y = yAfter;
        }
      }

      const stamp = new Date();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const fileName = `export-adresses-${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Erreur export adresses PDF', err);
      this.snackBar.open("Erreur lors de la génération du PDF d'adresses.", 'Fermer', { duration: 5000 });
    }
  }
}
