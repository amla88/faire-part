import { Component } from '@angular/core';
import { Router } from '@angular/router';
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

  constructor(private router: Router) {}

  onInput() {
    this.code = (this.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  onSubmit() {
    const trimmed = (this.code || '').trim();
    if (!trimmed) return;
    const uuid = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Persiste le token pour les pages Angular (hash routing inclus)
    try { localStorage.setItem('login_uuid', uuid); } catch {}
    // Navigation SPA: on reste dans l'app Angular (hash routing), sans chemin spécifique à GitHub Pages
    const params = `uuid=${encodeURIComponent(uuid)}`;
    this.router.navigateByUrl(`/person?${params}`);
  }
}
