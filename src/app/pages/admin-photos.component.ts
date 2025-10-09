import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PhotoGalleryService, PhotoRow, PhotoStatus } from '../services/photo-gallery.service';
import { ToastService } from '../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-admin-photos',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatSelectModule, MatIconModule, MatProgressBarModule],
  templateUrl: './admin-photos.component.html',
  styleUrls: ['./admin-photos.component.css']
})
export class AdminPhotosComponent {
  photos: PhotoRow[] = [];
  loading = false;
  error = '';
  filter: 'all' | PhotoStatus = 'all';
  message = '';
  messageColor: string = 'green';

  constructor(private service: PhotoGalleryService, private toast: ToastService) {
    this.load();
  }

  async load() {
    this.loading = true; this.error = '';
    try {
      this.photos = await this.service.adminList(this.filter);
    } catch (e: any) {
      if (this.filter !== 'all') {
        try { this.photos = await this.service.adminList('all'); } catch {}
      }
      this.error = e?.message || 'Erreur de chargement';
    } finally {
      this.loading = false;
    }
  }

  async setStatus(p: PhotoRow, status: PhotoStatus) {
    if (!p.id) return alert('Status non disponible sans table photos');
    try {
      await this.service.setStatus(p.id, status);
      this.toast.success(status === 'approved' ? 'Photo approuvée' : 'Photo rejetée');
      await this.load();
    } catch (e: any) {
      this.toast.error('Impossible de modifier le statut');
    }
  }

  async remove(p: PhotoRow) {
    if (!confirm('Supprimer cette photo ?')) return;
    try {
      await this.service.remove(p);
      this.photos = this.photos.filter(x => x !== p);
      this.toast.info('Photo supprimée');
    } catch (e: any) {
      this.toast.error('Suppression impossible');
    }
  }

  async copy(url?: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.message = 'Lien copié';
      this.messageColor = 'green';
      setTimeout(() => (this.message = ''), 2000);
    } catch {
      this.message = 'Impossible de copier';
      this.messageColor = '#b00020';
    }
  }
}
