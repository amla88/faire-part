import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, AppUser } from 'src/app/services/auth.service';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';

/** Page invitée : Day After / 40 ans — image + texte mission. */
@Component({
  selector: 'app-anniversaire-40',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './anniversaire-40.component.html',
  styleUrls: ['./anniversaire-40.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Anniversaire40Component implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(NgSupabaseService);
  private readonly snack = inject(MatSnackBar);

  readonly heroSrc = 'assets/images/backgrounds/anniversaire.png';

  readonly loadingPresence = signal(true);
  readonly savingPresence = signal(false);
  readonly presentAnniversaire = signal(false);
  readonly presenceLoadError = signal<string | null>(null);
  private personneId: number | null = null;

  readonly programme = [
    {
      icon: 'sports_esports',
      title: 'Arcade & High Score',
      text: "Des bornes d'arcade en libre-service pour défier tes amis sur les classiques des années 90/00.",
    },
    {
      icon: 'local_pizza',
      title: 'Pizza & Hops',
      text: 'Un buffet de pizzas fumantes et une sélection de bières fraîches pour recharger les batteries.',
    },
    {
      icon: 'album',
      title: 'Open Dancefloor',
      text: 'Une sono chargée à bloc pour une ambiance laser et boule à facettes.',
    },
    {
      icon: 'directions_run',
      title: 'Tournoi de DDR (Dance Dance Revolution)',
      text: 'Pour prouver que tu as encore les jambes de tes 20 ans.',
    },
    {
      icon: 'weekend',
      title: 'Chill Zone',
      text: 'Des écrans rétro et des coins lounge pour refaire le monde (et le mariage de la veille).',
    },
  ] as const;

  ngOnInit(): void {
    void this.loadPresence();
  }

  async onPresenceChange(checked: boolean): Promise<void> {
    if (this.savingPresence()) return;
    const pid = this.personneId;
    if (pid == null) return;
    if (checked === this.presentAnniversaire()) return;

    this.savingPresence.set(true);
    try {
      const user = this.auth.getUser();
      if (!user?.famille_id || !this.auth.getToken()) {
        throw new Error('Session expirée — veuillez vous reconnecter.');
      }
      const client = this.supabase.getClient();
      const { error } = await client.rpc('record_rsvp', {
        p_famille_id: user.famille_id,
        p_payload: [{ personne_id: pid, present_anniversaire: checked }],
      });
      if (error) throw error;

      this.presentAnniversaire.set(checked);
      this.snack.open(
        checked
          ? 'Merci — votre présence à l’anniversaire est enregistrée.'
          : 'C’est noté — vous ne serez pas compté(e) présent(e) à l’anniversaire.',
        undefined,
        { duration: 4000 }
      );
    } catch (e: any) {
      this.snack.open(e?.message || 'Enregistrement impossible', 'OK', { duration: 5500 });
    } finally {
      this.savingPresence.set(false);
    }
  }

  private async loadPresence(): Promise<void> {
    this.loadingPresence.set(true);
    this.presenceLoadError.set(null);
    try {
      const user = this.auth.getUser();
      if (!user?.famille_id) {
        this.presenceLoadError.set('Session invalide.');
        return;
      }
      const pid = this.resolveAnniversairePersonneId(user);
      this.personneId = pid;
      if (pid == null) {
        this.presenceLoadError.set('Sélectionnez une personne via « Changer de personnage » pour enregistrer votre présence.');
        return;
      }
      const client = this.supabase.getClient();
      const { data, error } = await client.rpc('get_personnes_by_famille', { p_famille_id: user.famille_id });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const row = rows.find((r: any) => Number(r.id) === Number(pid));
      if (!row) throw new Error('Données personne introuvables.');
      this.presentAnniversaire.set(!!row.present_anniversaire);
    } catch (e: any) {
      this.presenceLoadError.set(e?.message || 'Impossible de charger votre réponse.');
    } finally {
      this.loadingPresence.set(false);
    }
  }

  /** Même personne que pour le menu / la garde : sélection explicite ou unique enfant. */
  private resolveAnniversairePersonneId(user: AppUser): number | null {
    if (!user.personnes?.length) return null;
    const pid =
      user.selected_personne_id != null
        ? Number(user.selected_personne_id)
        : user.personnes.length === 1
          ? Number(user.personnes[0].id)
          : NaN;
    if (!Number.isFinite(pid)) return null;
    return pid;
  }
}
