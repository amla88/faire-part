import { Component, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { AuthService, AppUser, PersonneSummary, SESSION_POST_LOGIN_ONBOARDING_KEY } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { ResponseSummaryComponent } from './response-summary/response-summary.component';
import { PostLoginWelcomeDialogComponent } from './post-login-welcome-dialog/post-login-welcome-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    ResponseSummaryComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  selectedPersonName = 'invité';

  readonly emailLoading = signal(true);
  readonly profileEmail = signal<string>('');

  constructor(
    private auth: AuthService,
    private avatar: AvatarService,
    private supabase: NgSupabaseService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user) {
      this.emailLoading.set(false);
      return;
    }

    const selectedId = this.resolvePersonneId(user);
    const personne = user.personnes?.find((p: PersonneSummary) => p.id === selectedId) ?? null;
    if (personne) {
      this.selectedPersonName = `${personne.prenom} ${personne.nom}`.trim();
    }
    if (selectedId != null) {
      void this.avatar.loadAvatarFromRpc(Number(selectedId));
    }
    void this.loadProfileEmail(selectedId);
    queueMicrotask(() => this.openPostLoginWelcomeIfNeeded());
  }

  private openPostLoginWelcomeIfNeeded(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (sessionStorage.getItem(SESSION_POST_LOGIN_ONBOARDING_KEY) !== '1') return;
      sessionStorage.removeItem(SESSION_POST_LOGIN_ONBOARDING_KEY);
      const ref = this.dialog.open(PostLoginWelcomeDialogComponent, {
        width: 'min(540px, calc(100vw - 24px))',
        maxWidth: '95vw',
        disableClose: true,
        autoFocus: 'first-tabbable',
        panelClass: 'post-login-welcome-dialog-panel',
      });
      ref.afterClosed().subscribe((result) => {
        if (result === 'game') {
          void this.router.navigate(['/jeu']);
        }
      });
    } catch {
      /* ignore */
    }
  }

  private resolvePersonneId(user: AppUser): number | null {
    const id =
      user.selected_personne_id ??
      user.personne_principale_id ??
      (user.personnes?.length === 1 ? user.personnes[0].id : null);
    return id != null ? Number(id) : null;
  }

  private async loadProfileEmail(personneId: number | null): Promise<void> {
    const token = this.auth.getToken();
    if (!token || personneId == null) {
      this.profileEmail.set('');
      this.emailLoading.set(false);
      return;
    }
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client.rpc('get_profile_for_token', {
        p_token: token,
        p_personne_id: personneId,
      });
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const em = String((row as { email?: string | null } | null)?.email ?? '').trim();
      this.profileEmail.set(em);
    } catch {
      this.profileEmail.set('');
    } finally {
      this.emailLoading.set(false);
    }
  }
}
