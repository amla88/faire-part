import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, PersonneSummary } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { ResponseSummaryComponent } from './response-summary/response-summary.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ResponseSummaryComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  selectedPersonName = 'invité';

  constructor(
    private auth: AuthService,
    private avatar: AvatarService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user) return;

    // Determine selected personne id (persisted or single person fallback)
    const selectedId = user.selected_personne_id ?? (user.personnes && user.personnes.length === 1 ? user.personnes[0].id : null);
    const personne = user.personnes?.find((p: PersonneSummary) => p.id === selectedId) ?? null;
    if (personne) {
      this.selectedPersonName = `${personne.prenom} ${personne.nom}`.trim();
    }
    /* Aligner le cache (localStorage) sur la base : si la ligne avatar a été supprimée côté DB, invalider l’ancienne image */
    if (selectedId != null) {
      void this.avatar.loadAvatarFromRpc(Number(selectedId));
    }
  }
}
