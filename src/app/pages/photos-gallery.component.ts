import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoGalleryService, PhotoRow } from '../services/photo-gallery.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  standalone: true,
  selector: 'app-photos-gallery',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './photos-gallery.component.html',
  styleUrls: ['./photos-gallery.component.css']
})
export class PhotosGalleryComponent {
  photos: PhotoRow[] = [];
  initialLoading = false;
  loadingMore = false;
  error = '';
  private pageSize = 24;
  private offset = 0;

  constructor(private service: PhotoGalleryService) {
    this.loadInitial();
  }

  async loadInitial() {
    this.initialLoading = true; this.error=''; this.photos = []; this.offset = 0;
    try {
      const { items, hasMore } = await this.service.listApprovedPaged(this.pageSize, this.offset);
      this.photos = items; this.offset += items.length; this.hasMore = hasMore;
    } catch (e: any) {
      this.error = e?.message || 'Impossible de charger la galerie';
    } finally {
      this.initialLoading = false;
    }
  }

  hasMore = false;

  async loadMore() {
    if (!this.hasMore || this.loadingMore) return;
    this.loadingMore = true; this.error='';
    try {
      const { items, hasMore } = await this.service.listApprovedPaged(this.pageSize, this.offset);
      this.photos = [...this.photos, ...items];
      this.offset += items.length;
      this.hasMore = hasMore;
    } catch (e: any) {
      this.error = e?.message || 'Erreur de chargement';
    } finally {
      this.loadingMore = false;
    }
  }
}
