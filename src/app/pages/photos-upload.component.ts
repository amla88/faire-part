import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PhotoGalleryService } from '../services/photo-gallery.service';
import { ToastService } from '../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-photos-upload',
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './photos-upload.component.html',
  styleUrls: ['./photos-upload.component.css']
})
export class PhotosUploadComponent {
  file: File | null = null;
  author = '';
  uploading = false;
  compressing = false;
  msg = '';
  msgColor = '#333';
  previewUrl: string | null = null;
  private lsAuthorKey = 'photos.author';
  private compressedBlob: Blob | null = null;
  originalSize = 0;
  compressedSize = 0;

  constructor(private service: PhotoGalleryService, private toast: ToastService) {
    try { this.author = localStorage.getItem(this.lsAuthorKey) || ''; } catch {}
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.setFile(input.files && input.files[0] ? input.files[0] : null);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0] || null;
    this.setFile(f);
  }

  setFile(f: File | null) {
    this.msg = '';
    this.file = null; this.previewUrl = null; this.compressedBlob = null; this.originalSize = 0; this.compressedSize = 0;
    if (!f) return;
    const okType = /image\/(jpeg|jpg|png)/i.test(f.type) || /\.(jpg|jpeg|png)$/i.test(f.name);
  if (!okType) { this.toast.error('Format invalide (JPG/PNG uniquement)'); return; }
  const max = 8 * 1024 * 1024; // 8MB
  if (f.size > max) { this.toast.error('Fichier trop volumineux (> 8 Mo)'); return; }
    this.file = f; this.originalSize = f.size;
    const reader = new FileReader();
    reader.onload = async () => {
      this.previewUrl = reader.result as string;
      try {
        this.compressing = true;
        this.compressedBlob = await this.compressImage(this.previewUrl, 1600, 0.82);
        this.compressedSize = this.compressedBlob.size;
      } catch {}
      finally { this.compressing = false; }
    };
    reader.readAsDataURL(f);
  }

  persistAuthor() {
    try { localStorage.setItem(this.lsAuthorKey, this.author); } catch {}
  }

  clear() {
    this.file = null; this.previewUrl = null; this.compressedBlob = null; this.msg = '';
  }

  async send() {
    if (!this.file) return;
    this.msg = ''; this.uploading = true;
    try {
      const toSend = this.compressedBlob instanceof Blob ? new File([this.compressedBlob], this.file.name, { type: this.compressedBlob.type }) : this.file;
      await this.service.upload(toSend, this.author || null);
      this.toast.success('Photo envoyée. Merci !');
      this.clear();
    } catch (e: any) {
      this.toast.error('Erreur upload');
    } finally {
      this.uploading = false;
    }
  }

  private async compressImage(dataUrl: string, maxSize: number, quality: number): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        else if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not available');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject('Compression failed');
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject('Image load failed');
      img.src = dataUrl;
    });
  }

  fmtSize(n: number): string {
    if (!n) return '0 B';
    const kb = n / 1024, mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(2)} Mo` : `${Math.round(kb)} Ko`;
  }
}
