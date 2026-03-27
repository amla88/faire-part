import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'src/app/services/auth.service';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { QRCodeComponent } from 'angularx-qrcode';

interface GuestProfile {
  personne_id: number;
  prenom: string;
  nom: string;
  email: string | null;
  famille_id: number;
  rue: string | null;
  numero: string | null;
  boite: string | null;
  cp: string | null;
  ville: string | null;
  pays: string | null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    QRCodeComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private supabase = inject(NgSupabaseService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  private document = inject(DOCUMENT);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly profile = signal<GuestProfile | null>(null);
  readonly selectedLabel = signal('');
  readonly mapEmbedUrl = signal<SafeResourceUrl | null>(null);
  readonly mapOpenUrl = signal<string | null>(null);
  readonly qrCodeUrl = signal<string | null>(null);
  private selectedPersonneId: number | null = null;

  form = this.fb.nonNullable.group({
    prenom: [{ value: '', disabled: true }],
    nom: [{ value: '', disabled: true }],
    email: ['', [Validators.maxLength(255), Validators.email]],
    rue: ['', [Validators.maxLength(255)]],
    numero: ['', [Validators.maxLength(30)]],
    boite: ['', [Validators.maxLength(30)]],
    cp: ['', [Validators.maxLength(20)]],
    ville: ['', [Validators.maxLength(120)]],
    pays: ['', [Validators.maxLength(120)]],
  });

  ngOnInit(): void {
    this.initQrCodeUrl();
    void this.loadProfile();
  }

  private initQrCodeUrl(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.qrCodeUrl.set(null);
      return;
    }
    const baseUrl = this.document.head
      .querySelector('meta[name="qr-code-base-url"]')
      ?.getAttribute('content')
      ?.trim() || '';
    if (!baseUrl) {
      this.qrCodeUrl.set(null);
      return;
    }
    this.qrCodeUrl.set(`${baseUrl}${token}`);
  }

  async loadProfile(): Promise<void> {
    const user = this.auth.getUser();
    const token = this.auth.getToken();
    const personneId = user?.selected_personne_id ?? user?.personne_principale_id ?? null;
    this.selectedPersonneId = personneId ? Number(personneId) : null;

    if (!token || !personneId) {
      this.profile.set(null);
      return;
    }

    const p = user?.personnes?.find((x) => Number(x.id) === Number(personneId));
    this.selectedLabel.set(p ? `${p.prenom} ${p.nom}`.trim() : '');

    this.loading.set(true);
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client.rpc('get_profile_for_token', {
        p_token: token,
        p_personne_id: Number(personneId),
      });
      if (error) {
        throw new Error(error.message || 'Chargement impossible');
      }
      const row = Array.isArray(data) ? data[0] : data;
      const profile = (row || null) as GuestProfile | null;
      this.profile.set(profile);
      if (profile) {
        this.form.patchValue({
          prenom: profile.prenom || '',
          nom: profile.nom || '',
          email: profile.email || '',
          rue: profile.rue || '',
          numero: profile.numero || '',
          boite: profile.boite || '',
          cp: profile.cp || '',
          ville: profile.ville || '',
          pays: profile.pays || '',
        });
        this.refreshMap();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chargement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
      this.profile.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  fullAddress(p: GuestProfile): string {
    const line1 = [p.rue, p.numero, p.boite ? `boîte ${p.boite}` : null].filter(Boolean).join(' ');
    const line2 = [p.cp, p.ville, p.pays].filter(Boolean).join(' ');
    return [line1, line2].filter(Boolean).join(', ');
  }

  refreshMap(): void {
    const v = this.form.getRawValue();
    const query = [v.rue, v.numero, v.boite, v.cp, v.ville, v.pays]
      .map((x) => (x || '').trim())
      .filter((x) => x.length > 0)
      .join(', ');

    if (!query) {
      this.mapEmbedUrl.set(null);
      this.mapOpenUrl.set(null);
      return;
    }

    const q = encodeURIComponent(query);
    const embed = `https://www.google.com/maps?q=${q}&output=embed`;
    const open = `https://www.google.com/maps?q=${q}`;
    this.mapEmbedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embed));
    this.mapOpenUrl.set(open);
  }

  async saveProfile(): Promise<void> {
    const token = this.auth.getToken();
    if (!token || !this.selectedPersonneId) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const client = this.supabase.getClient();
      const { data, error } = await client.rpc('update_profile_for_token', {
        p_token: token,
        p_personne_id: this.selectedPersonneId,
        p_email: v.email,
        p_rue: v.rue,
        p_numero: v.numero,
        p_boite: v.boite,
        p_cp: v.cp,
        p_ville: v.ville,
        p_pays: v.pays,
      });
      if (error || data !== true) {
        throw new Error(error?.message || 'Enregistrement impossible');
      }
      this.snack.open('Profil mis à jour', undefined, { duration: 2500 });
      await this.loadProfile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Enregistrement impossible';
      this.snack.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  downloadQrCode(): void {
    const qrCanvas = this.document.querySelector('.profile-qr qrcode canvas') as HTMLCanvasElement | null;
    if (!qrCanvas) return;
    const a = this.document.createElement('a');
    a.href = qrCanvas.toDataURL('image/png');
    a.download = `QR_Invitation_${(this.selectedLabel() || 'invite').replace(/\s+/g, '_')}.png`;
    this.document.body.appendChild(a);
    a.click();
    this.document.body.removeChild(a);
  }

  addLoginLinkToFavorites(): void {
    const url = this.qrCodeUrl();
    if (!url) return;
    const title = `Invitation ${this.selectedLabel() || ''}`.trim();

    const win = window as any;
    try {
      if (win.external && typeof win.external.AddFavorite === 'function') {
        win.external.AddFavorite(url, title || 'Invitation');
        this.snack.open('Lien ajouté aux favoris', undefined, { duration: 2200 });
        return;
      }
      if (win.sidebar && typeof win.sidebar.addPanel === 'function') {
        win.sidebar.addPanel(title || 'Invitation', url, '');
        this.snack.open('Lien ajouté aux favoris', undefined, { duration: 2200 });
        return;
      }
    } catch {
      // Fallback below
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => undefined);
    }
    this.snack.open(
      'Ajout automatique non supporté. Utilisez Ctrl+D (ou Cmd+D) ; le lien a été copié.',
      'OK',
      { duration: 6000 }
    );
  }
}

