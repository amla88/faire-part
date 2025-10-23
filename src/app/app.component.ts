import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ToastContainerComponent } from './components/toast-container.component';
import { CommonModule } from '@angular/common';
import { SessionService } from './services/session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, ToastContainerComponent, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private session: SessionService, private router: Router) {}

  get uuid() { return this.session.getUuid(); }
  get selectedPersonne() { return this.session.getSelectedPersonne(); }
  get personnePrincipale() { return this.session.getPersonnePrincipale(); }

  goToPersonSwitcher() {
    const uuid = this.session.getUuid();
    this.router.navigate(['/person'], {
      queryParams: uuid ? { uuid } : {},
      queryParamsHandling: 'merge'
    });
  }

  logout() {
    this.session.logout();
    // On ne gère pas ici la navigation: la vue l'appelle et le routeur vire le uuid
    // Un simple reload de /login sans query params
    const base = `${window.location.origin}${window.location.pathname}`;
    // Si l'app est servie sous un sous-chemin (ex: /faire-part/), pathname le contient déjà
    // On s'assure d'aller sur la page login Angular (hash routing)
    const url = `${base}#/login`;
    window.location.assign(url);
  }
}
