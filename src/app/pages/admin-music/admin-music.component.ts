import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MusicPreferencesService, MusicStatus } from '../../services/music-preferences.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-admin-music',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatSelectModule, MatIconModule, MatTableModule, MatProgressBarModule],
  templateUrl: './admin-music.component.html',
  styleUrls: ['./admin-music.component.css']
})
export class AdminMusicComponent {
  items: any[] = [];
  loading = false;
  error = '';
  filter: 'all' | MusicStatus = 'all';
  message = '';
  messageColor = 'green';

  constructor(private service: MusicPreferencesService, private toast: ToastService) {
    this.load();
  }

  async load() {
    this.loading = true; this.error = '';
    try {
      this.items = this.filter === 'all'
        ? await this.service.listAll()
        : await this.service.listByStatus(this.filter);
    } catch (e: any) {
      // En cas d'absence de colonne status, fallback à la liste complète
      if (this.filter !== 'all') {
        try {
          this.items = await this.service.listAll();
        } catch {}
      }
      this.error = e?.message || 'Erreur de chargement';
    } finally {
      this.loading = false;
    }
  }

  confirmSetStatus(id: number, status: MusicStatus) {
    if (!confirm(`Confirmer ${status === 'approved' ? 'l\'approbation' : 'le rejet'} ?`)) return;
    this.trySetStatus(id, status);
  }

  async trySetStatus(id: number, status: MusicStatus) {
    try {
      await this.service.setStatus(id, status);
      this.toast.success(status === 'approved' ? 'Approuvé' : 'Rejeté');
      await this.load();
    } catch (e: any) {
      this.toast.error("Impossible de changer le statut (colonne absente ?)");
    }
  }

  async remove(id: number) {
    if (!confirm('Supprimer cette proposition ?')) return;
    try {
      await this.service.remove(id);
      this.items = this.items.filter(x => x.id !== id);
    } catch (e: any) {
      alert('Suppression impossible: ' + (e?.message || e));
    }
  }
}
