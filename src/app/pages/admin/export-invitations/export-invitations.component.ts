import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { QRCodeComponent } from 'angularx-qrcode';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import * as QRCode from 'qrcode';
import JSZip from 'jszip';

// Basic interfaces based on assumptions
export interface Personne {
  id: number;
  prenom: string;
  nom: string;
  famille_id: number;
  invite_reception: boolean;
  invite_repas: boolean;
  invite_soiree: boolean;

}

export interface Famille {
  id: number;
  personne_principale: number;
  login_token: string;
  personnes: Personne[];
}

type FilterType = 'reception' | 'soiree' | 'reception_soiree' | 'tout';

@Component({
  selector: 'app-export-invitations',
  templateUrl: './export-invitations.component.html',
  styleUrls: ['./export-invitations.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    FormsModule,
    QRCodeComponent,
    MatSlideToggleModule
  ],
})
export class ExportInvitationsComponent {
  private supabase = inject(NgSupabaseService);

  loading = signal(true);
  familles = signal<Famille[]>([]);
  
  // Filters
  activeFilter = signal<FilterType | null>(null);
  showQrCodes = signal(false);

  filteredFamilles = computed(() => {
    const allFamilles = this.familles();
    const currentFilter = this.activeFilter();

    if (!currentFilter) {
      return allFamilles;
    }

    return allFamilles.map(f => {
      let personnes: Personne[];

      switch (currentFilter) {
        case 'reception':
          personnes = f.personnes.filter(p => p.invite_reception && !p.invite_repas && !p.invite_soiree);
          break;
        case 'soiree':
          personnes = f.personnes.filter(p => !p.invite_reception && !p.invite_repas && p.invite_soiree);
          break;
        case 'reception_soiree':
          personnes = f.personnes.filter(p => p.invite_reception && !p.invite_repas && p.invite_soiree);
          break;
        case 'tout':
          personnes = f.personnes.filter(p => p.invite_reception && p.invite_repas && p.invite_soiree);
          break;
        default:
          personnes = f.personnes;
          break;
      }
      return { ...f, personnes };
    }).filter(f => f.personnes.length > 0);
  });

  totalPersonnes = computed(() => {
    return this.filteredFamilles().reduce((acc, f) => acc + f.personnes.length, 0);
  });

  displayedColumns: string[] = ['famille', 'personnes', 'login_token', 'qrcode'];

  constructor() {
    this.fetchFamilles();
    effect(() => {
      if(this.showQrCodes()){
        if(!this.displayedColumns.includes('qrcode')){
          this.displayedColumns.push('qrcode');
        }
      } else {
        if(this.displayedColumns.includes('qrcode')){
          this.displayedColumns = this.displayedColumns.filter(c => c !== 'qrcode');
        }
      }
    });
  }

  updateFilter(filter: FilterType, isChecked: boolean) {
    if (isChecked) {
      this.activeFilter.set(filter);
    } else if (this.activeFilter() === filter) {
      this.activeFilter.set(null);
    }
  }

  async fetchFamilles() {
    this.loading.set(true);
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('familles')
      .select(`
        id,
        personne_principale,
        login_token,
        personnes:personnes!personnes_famille_id_fkey (
          id,
          prenom,
          nom,
          invite_reception,
          invite_repas,
          invite_soiree
        )
      `);

    if (error) {
      console.error('Error fetching families:', error);
      this.familles.set([]);
    } else {
      this.familles.set(data as Famille[]);
    }
    this.loading.set(false);
  }

  async exportToZip() {
    const familles = this.filteredFamilles();
    if (!familles.length) return;

    this.loading.set(true);

    try {
      const zip = new JSZip();
      const headers = ['famille', 'prenom', 'nom', 'loginToken', '@qrCode'];
      const csvRows = [headers.join(',')];

      for (const famille of familles) {
        const familyName = this.getFamilyDisplayName(famille);
        const qrCodeFileName = `${famille.login_token}.png`;

        for (const personne of famille.personnes) {
          const row = [
            `"${familyName}"`,
            `"${personne.prenom}"`,
            `"${personne.nom}"`,
            `"${famille.login_token}"`,
            `"${qrCodeFileName}"`
          ];
          csvRows.push(row.join(','));
        }

        // Generate QR code and add to zip
        const loginUrl = this.getLoginUrl(famille.login_token);
        const qrCodeDataUrl = await QRCode.toDataURL(loginUrl, { errorCorrectionLevel: 'M', width: 300 });
        const qrCodeBlob = this.dataUrlToBlob(qrCodeDataUrl);
        zip.file(qrCodeFileName, qrCodeBlob);
      }

      const csvContent = csvRows.join('\n');
      zip.file('invitations.csv', csvContent);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(zipBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'export-invitations.zip');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating ZIP file:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  getFamilyDisplayName(famille: Famille): string {
    if (famille.personne_principale && famille.personnes) {
      const principale = famille.personnes.find(p => p.id === famille.personne_principale);
      if (principale) {
        return `Famille ${principale.prenom} ${principale.nom}`;
      }
    }
    if (famille.personnes && famille.personnes.length > 0) {
      const firstPerson = famille.personnes[0];
      if (famille.personnes.length > 1) {
        return `Famille ${firstPerson.nom}`;
      } else {
        return `${firstPerson.prenom} ${firstPerson.nom}`;
      }
    }
    return `Famille #${famille.id}`;
  }

  getLoginUrl(token: string): string {
    return `${window.location.origin}/#/quick-login?token=${token}`;
  }
}
