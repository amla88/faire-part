import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSupabaseService } from '../../services/supabase.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-admin-login',
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';

  constructor(private api: NgSupabaseService, private router: Router) {}

  async submit() {
    this.error = '';
    try {
      const { data, error } = await this.api.supabase.auth.signInWithPassword({ email: this.email, password: this.password });
      if (error) throw error;
      // Attendre que la session soit active
      for (let i = 0; i < 10; i++) {
        const { data: { user } } = await this.api.supabase.auth.getUser();
        if (user) {
          await this.router.navigateByUrl('/admin');
          return;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      this.error = 'Session non initialisée, veuillez réessayer.';
    } catch (e: any) {
      this.error = e?.message || 'Erreur de connexion';
    }
  }
}
