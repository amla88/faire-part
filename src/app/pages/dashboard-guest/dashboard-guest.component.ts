import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SessionService } from '../../services/session.service';

@Component({
  standalone: true,
  selector: 'app-dashboard-guest',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dashboard-wrapper">
      <mat-card class="welcome-card">
        <mat-card-header>
          <mat-card-title *ngIf="selectedPersonne">
            Bienvenue {{ selectedPersonne.prenom }} {{ selectedPersonne.nom }} !
          </mat-card-title>
          <mat-card-subtitle *ngIf="personnePrincipale">
            Famille {{ personnePrincipale.nom }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Utilise le menu à gauche pour explorer les différentes sections.</p>
          <div class="quick-actions">
            <p><strong>Actions rapides :</strong></p>
            <div class="action-buttons">
              <button mat-raised-button color="primary" (click)="goTo('/game')">
                <mat-icon>sports_esports</mat-icon>
                Lancer le jeu
              </button>
              <button mat-raised-button (click)="goTo('/avatar')">
                <mat-icon>face</mat-icon>
                Éditer mon avatar
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      height: 100%;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 24px;
    }

    .welcome-card {
      width: 100%;
      max-width: 500px;
    }

    .quick-actions {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    button {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    ::ng-deep .mdc-card__header {
      padding: 16px 16px 0 16px;
    }

    ::ng-deep .mat-mdc-card-header {
      display: block;
    }
  `]
})
export class DashboardGuestComponent implements OnInit {
  selectedPersonne: any = null;
  personnePrincipale: any = null;

  constructor(private session: SessionService, private router: Router) {}

  async ngOnInit() {
    await this.session.init();
    this.selectedPersonne = this.session.getSelectedPersonne();
    this.personnePrincipale = this.session.getPersonnePrincipale();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }
}
