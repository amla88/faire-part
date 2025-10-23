import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { NgSupabaseService } from '../../services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-rsvp',
  imports: [CommonModule, FormsModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './rsvp.component.html',
  styleUrls: ['./rsvp.component.css']
})
export class RsvpComponent {
  familleId: number | null = null; // TODO: à alimenter depuis le contexte famille
  submitting = false;
  message = '';
  error = '';

  model: any = {
    pour_apero: false,
    pour_repas: false,
    pour_soiree: false,
    contraintes_text: ''
  };

  constructor(private api: NgSupabaseService) {
    // Essaie de récupérer le user via le login_uuid stocké par la page jeu React
    const uuid = localStorage.getItem('login_uuid');
    if (uuid) {
      this.api.getFamilleByToken(uuid).then(famille => {
        if (famille?.id) this.familleId = famille.id;
      }).catch(() => {/* ignore */});
    }
  }

  async submit() {
    this.message = '';
    this.error = '';
    if (!this.familleId) { this.error = 'Famille ID manquant'; return; }
    this.submitting = true;
    try {
      await this.api.recordRsvp(this.familleId, this.model);
      this.message = 'RSVP enregistré';
    } catch (e: any) {
      this.error = e?.message || 'Erreur lors de la sauvegarde';
    } finally {
      this.submitting = false;
    }
  }
}
