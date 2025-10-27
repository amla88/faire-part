import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FamilyPhoto, PhotoService } from 'src/app/services/photo.service';

@Component({
  selector: 'app-photo-album',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './photo-album.component.html',
  styleUrls: ['./photo-album.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private photoService = inject(PhotoService);

  readonly photos = signal<FamilyPhoto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  readonly hasPhotos = computed(() => this.photos().length > 0);

  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const items = await this.photoService.listFamilyPhotos();
      this.photos.set(items);
      this.lastLoadedAt.set(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger votre album';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  readonly formatDate = (value: string | null): string => {
    if (!value) {
      return 'Date inconnue';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Date inconnue';
    }
    return this.dateFormatter.format(date);
  };

  readonly formatSize = (value: number): string => {
    if (!value) {
      return '0 o';
    }
    const kilo = value / 1024;
    if (kilo < 1024) {
      return `${kilo.toFixed(1)} Ko`;
    }
    const mega = kilo / 1024;
    if (mega < 1024) {
      return `${mega.toFixed(1)} Mo`;
    }
    const giga = mega / 1024;
    return `${giga.toFixed(2)} Go`;
  };
}
