import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Connexion Invité</mat-card-title>
          <mat-card-subtitle>Veuillez entrer votre code de connexion</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form (submit)="login()">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Code ou Token</mat-label>
              <input 
                matInput 
                [(ngModel)]="token" 
                name="token"
                placeholder="Collez votre token ici"
                type="password"
              />
              <mat-hint>Vous pouvez scanner le QR code ou coller le lien d'invitation</mat-hint>
            </mat-form-field>

            <div *ngIf="error" class="error-message">
              <mat-error>{{ error }}</mat-error>
            </div>

            <div *ngIf="loading" class="loading">
              <mat-spinner diameter="30"></mat-spinner>
              <p>Vérification en cours...</p>
            </div>
          </form>
        </mat-card-content>

        <mat-card-actions align="end">
          <button 
            mat-raised-button 
            color="primary" 
            (click)="login()"
            [disabled]="loading || !token"
          >
            Connexion
          </button>
        </mat-card-actions>
      </mat-card>

      <div class="admin-link">
        <a routerLink="/admin-login">Accès Admin</a>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      background-color: #f5f5f5;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
    }

    .full-width {
      width: 100%;
    }

    .error-message {
      margin-top: 16px;
      padding: 12px;
      background-color: #ffebee;
      border-left: 4px solid #f44336;
      color: #d32f2f;
      border-radius: 4px;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding: 16px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }

    .admin-link {
      margin-top: 24px;
      text-align: center;
    }

    .admin-link a {
      color: #3f51b5;
      text-decoration: none;
      font-size: 14px;

      &:hover {
        text-decoration: underline;
      }
    }
  `],
})
export class LoginComponent {
  token = '';
  loading = false;
  error: string | null = null;

  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  async login() {
    if (!this.token) return;

    this.loading = true;
    this.error = null;

    try {
      // Stocker le token dans localStorage
      localStorage.setItem('login_uuid', this.token);
      
      // Initialiser la session
      await this.session.init();

      if (this.session.error) {
        this.error = this.session.error;
        localStorage.removeItem('login_uuid');
        this.loading = false;
        return;
      }

      // Redirection vers le sélecteur de personne
      this.router.navigate(['/person']);
    } catch (e) {
      const err = e as Error;
      this.error = err?.message || 'Erreur de connexion';
      localStorage.removeItem('login_uuid');
    } finally {
      this.loading = false;
    }
  }
}

