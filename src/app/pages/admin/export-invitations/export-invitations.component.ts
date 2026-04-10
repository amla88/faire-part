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

type FilterType = 'reception' | 'soiree' | 'reception_soiree' | 'tout' | 'autre';

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
        case 'autre':
          personnes = f.personnes.filter((p) => !this.personneMatchesUnDesQuatreFiltres(p));
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

  /** True si la personne entre dans l’un des 4 filtres « standard » (réception seule, soirée seule, réception+soirée sans repas, tout). */
  private personneMatchesUnDesQuatreFiltres(p: Personne): boolean {
    const R = !!p.invite_reception;
    const P = !!p.invite_repas;
    const S = !!p.invite_soiree;
    return (
      (R && !P && !S) ||
      (!R && !P && S) ||
      (R && !P && S) ||
      (R && P && S)
    );
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
      // One CSV row per family (publipostage): primary last name first, then unique other last names.
      const headers = ['famille', 'loginToken', '@qrCode'];
      const sep = ';';
      const csvRows = [headers.join(sep)];
      const indesignHeaders = ['famille', 'loginToken', '@qrCode'];
      const tsvRows = [indesignHeaders.join('\t')];

      for (const famille of familles) {
        const familyName = this.getFamilyExportName(famille);
        const qrCodeFileName = `${famille.login_token}.png`;

        const row = [
          this.csvEscape(familyName),
          this.csvEscape(famille.login_token),
          this.csvEscape(qrCodeFileName),
        ];
        csvRows.push(row.join(sep));

        tsvRows.push(
          [this.tsvCell(familyName), this.tsvCell(famille.login_token), this.tsvCell(qrCodeFileName)].join('\t')
        );

        // Generate QR code and add to zip
        const loginUrl = this.getLoginUrl(famille.login_token);
        const qrCodeDataUrl = await QRCode.toDataURL(loginUrl, { errorCorrectionLevel: 'M', width: 300 });
        const qrCodeBlob = this.dataUrlToBlob(qrCodeDataUrl);
        zip.file(qrCodeFileName, qrCodeBlob);
      }

      // Excel-friendly CSV: UTF-8 with BOM + CRLF newlines to preserve accents (e.g., Isaé).
      const csvContent = `\uFEFF${csvRows.join('\r\n')}`;
      zip.file('invitations.csv', csvContent);

      // InDesign Data Merge: tabulations + UTF-16 LE + BOM (souvent requis pour « fichier pris en charge » + accents).
      const tsvText = tsvRows.join('\r\n');
      zip.file('invitations_indesign.txt', this.encodeUtf16Le(tsvText), { binary: true });

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

  private csvEscape(value: unknown): string {
    const s = String(value ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }

  /** Pas de tab / retours ligne dans une cellule TSV (InDesign). */
  private tsvCell(value: unknown): string {
    return String(value ?? '')
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }

  /** UTF-16 LE avec BOM — format souvent requis par InDesign (publipostage / accents). */
  private encodeUtf16Le(text: string): Uint8Array {
    const parts: number[] = [];
    for (const char of text) {
      const cp = char.codePointAt(0)!;
      if (cp <= 0xffff) {
        parts.push(cp & 0xff, (cp >> 8) & 0xff);
      } else {
        const c = cp - 0x10000;
        const hi = 0xd800 + (c >> 10);
        const lo = 0xdc00 + (c & 0x3ff);
        parts.push(hi & 0xff, (hi >> 8) & 0xff, lo & 0xff, (lo >> 8) & 0xff);
      }
    }
    const bom = new Uint8Array([0xff, 0xfe]);
    const body = new Uint8Array(parts);
    const out = new Uint8Array(bom.length + body.length);
    out.set(bom, 0);
    out.set(body, bom.length);
    return out;
  }

  /**
   * Export label: primary person's last name first, then unique other last names (no duplicates).
   * Example: Arnaud Hecq (primary), Laura Toubeau, Elena Hecq => "Hecq - Toubeau".
   */
  private getFamilyExportName(famille: Famille): string {
    const personnes = Array.isArray(famille.personnes) ? famille.personnes : [];
    const principale = famille.personne_principale
      ? personnes.find((p) => Number(p.id) === Number(famille.personne_principale))
      : undefined;

    const primaryNom = (principale?.nom || '').trim();
    const noms = personnes
      .map((p) => (p?.nom || '').trim())
      .filter((n) => n.length > 0);

    const uniqueOther = Array.from(new Set(noms)).filter((n) => n !== primaryNom);
    const parts = [primaryNom, ...uniqueOther].filter((x) => x && x.length > 0);
    if (parts.length > 0) return parts.join(' - ');

    // Fallbacks
    if (noms.length > 0) return Array.from(new Set(noms)).join(' - ');
    return `Famille #${famille.id}`;
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
