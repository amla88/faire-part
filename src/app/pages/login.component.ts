import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  code = '';

  onInput() {
    this.code = (this.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  onSubmit() {
    const trimmed = (this.code || '').trim();
    if (!trimmed) return;
    const uuid = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Persiste le token pour les pages Angular (hash routing inclus)
    try { localStorage.setItem('login_uuid', uuid); } catch {}
    // Navigation: si l’objectif est d’aller dans l’app Angular (ex. avatar/person), on peut rester côté Angular
    // Pour conserver le comportement actuel vers le jeu React, on met aussi le paramètre quand nécessaire.
    const params = `uuid=${encodeURIComponent(uuid)}`;
    // Choix: par défaut on renvoie sur la Home Angular avec le token; les autres pages le liront
    const url = `${window.location.origin}/faire-part/ng/#/?${params}`;
    window.location.assign(url);
  }
}
