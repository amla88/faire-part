import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FamilyPhoto, PhotoService } from 'src/app/services/photo.service';
import { ConfirmDialogService } from 'src/app/shared/dialogs/confirm-dialog/confirm-dialog.service';
import { ConfirmDialogData } from 'src/app/shared/dialogs/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-photo-album',
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './photo-album.component.html',
  styleUrls: ['./photo-album.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoAlbumComponent {
  private photoService = inject(PhotoService);
  private confirmDialog = inject(ConfirmDialogService);
  private snack = inject(MatSnackBar);

  readonly photos = signal<FamilyPhoto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  readonly sortBy = signal<'date' | 'name' | 'size'>('date');
  readonly sortDir = signal<'desc' | 'asc'>('desc');
  readonly deletingKeys = signal<Set<string>>(new Set());

  readonly sortedPhotos = computed(() => {
    const items = this.photos();
    const by = this.sortBy();
    const dir = this.sortDir();

    const sorted = [...items].sort((a, b) => {
      if (by === 'name') {
        const va = (a.name || '').toLowerCase();
        const vb = (b.name || '').toLowerCase();
        return va.localeCompare(vb, 'fr');
      }
      if (by === 'size') {
        return (a.size || 0) - (b.size || 0);
      }
      // date
      const ta = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const tb = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return ta - tb;
    });

    return dir === 'asc' ? sorted : sorted.reverse();
  });

  readonly hasPhotos = computed(() => this.sortedPhotos().length > 0);

  readonly photoCount = computed(() => this.sortedPhotos().length);

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

  async deletePhoto(photo: FamilyPhoto): Promise<void> {
    const dialogData: ConfirmDialogData = {
      title: 'Supprimer cette photo ?',
      message: 'Cette action est définitive.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      isDanger: true,
    };
    const ok = await this.confirmDialog.confirm(dialogData);
    if (!ok) return;

    const key = photo.key;
    const set = new Set(this.deletingKeys());
    set.add(key);
    this.deletingKeys.set(set);

    try {
      await this.photoService.deleteFamilyPhoto(key);
      // Optimistic update
      this.photos.set(this.photos().filter((p) => p.key !== key));
      this.snack.open('Photo supprimée', undefined, { duration: 2500 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Suppression impossible';
      this.snack.open(message, 'OK', { duration: 5000 });
    } finally {
      const next = new Set(this.deletingKeys());
      next.delete(key);
      this.deletingKeys.set(next);
    }
  }

  isDeleting(photo: FamilyPhoto): boolean {
    return this.deletingKeys().has(photo.key);
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
