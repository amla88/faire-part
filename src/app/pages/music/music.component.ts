import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MusicPreferencesService, MusicPreference } from '../../services/music-preferences.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-music',
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatChipsModule, MatIconModule],
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.css']
})
export class MusicComponent {
  form: MusicPreference = {
    artist1: '', title1: '', link1: '', comment1: '',
    artist2: '', title2: '', link2: '', comment2: ''
  };
  submitting = false;
  message = '';
  messageColor = '#333';
  private lsKey = 'music.form';

  constructor(private service: MusicPreferencesService, private toast: ToastService) {
    // Récupérer le brouillon éventuel
    try {
      const raw = localStorage.getItem(this.lsKey);
      if (raw) this.form = { ...this.form, ...(JSON.parse(raw) as any) };
    } catch {}
  }

  get secondPartiallyFilled() {
    const { artist2, title2, link2, comment2 } = this.form;
    return !!(artist2 || title2 || link2 || comment2);
  }

  isSecondValid(): boolean {
    const { artist2, title2 } = this.form;
    if (!this.secondPartiallyFilled) return true; // pas de seconde musique => ok
    return !!(artist2 && title2);
  }

  canSubmit(f: any): boolean {
    // Musique 1: artiste + titre requis
    const ok1 = !!(this.form.artist1 && this.form.title1);
    // Musique 2: si partiellement renseignée, artiste + titre requis
    const ok2 = this.isSecondValid();
    return f?.form?.valid && ok1 && ok2;
  }

  persist() {
    try { localStorage.setItem(this.lsKey, JSON.stringify(this.form)); } catch {}
  }

  reset() {
    this.form = { artist1: '', title1: '', link1: '', comment1: '', artist2: '', title2: '', link2: '', comment2: '' };
    try { localStorage.removeItem(this.lsKey); } catch {}
  }

  async submit() {
    this.submitting = true; this.message = '';
    try {
      await this.service.submit(this.form);
      this.toast.success('Merci pour ta contribution !');
      this.reset();
    } catch (e: any) {
      this.toast.error("Erreur lors de l'envoi");
    } finally {
      this.submitting = false;
    }
  }
}
