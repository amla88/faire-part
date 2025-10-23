import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { Router } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { Personne } from '../../models';

@Component({
  selector: 'app-person-switcher',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div class="person-switcher-container">
      <mat-card class="person-card">
        <mat-card-header>
          <mat-card-title>Bienvenue {{ famille?.nom_famille }}</mat-card-title>
          <mat-card-subtitle>Choisissez la personne</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <p *ngIf="!personnes || personnes.length === 0" class="text-center">
            Aucune personne trouvée
          </p>
          
          <div class="persons-grid">
            <mat-card 
              *ngFor="let personne of personnes; trackBy: trackByPersonne"
              class="person-item"
              (click)="selectPersonne(personne)"
              [class.selected]="session.selectedPersonneId === personne.id"
            >
              <mat-card-header>
                <mat-icon class="large-icon">person</mat-icon>
              </mat-card-header>
              <mat-card-content class="text-center">
                <strong>{{ personne.prenom }} {{ personne.nom }}</strong>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-card-content>

        <mat-card-actions align="end">
          <button mat-button (click)="logout()">Se déconnecter</button>
          <button mat-raised-button color="primary" (click)="continuer()" [disabled]="!session.selectedPersonneId">
            Continuer
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .person-switcher-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      background-color: #f5f5f5;
    }

    .person-card {
      width: 100%;
      max-width: 600px;
    }

    .persons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }

    .person-item {
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
      text-align: center;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      &.selected {
        border-color: #3f51b5;
        background-color: #f0f7ff;
      }
    }

    .large-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }

    .text-center {
      text-align: center;
    }

    mat-card-actions {
      padding: 16px;
    }
  `]
})
export class PersonSwitcherComponent implements OnInit {
  famille = this.session.getFamille();
  personnes: Personne[] = [];

  constructor(
    public session: SessionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.personnes = this.session.personnes;
    if (this.personnes.length === 0) {
      this.router.navigate(['/login']);
    }
  }

  selectPersonne(personne: Personne) {
    this.session.setSelectedPersonneId(personne.id);
  }

  trackByPersonne(index: number, personne: Personne): number {
    return personne.id;
  }

  continuer() {
    this.router.navigate(['/game']);
  }

  logout() {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
