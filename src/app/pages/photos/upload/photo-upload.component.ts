import { Component, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PhotoService } from 'src/app/services/photo.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-photo-upload',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  templateUrl: './photo-upload.component.html',
  styleUrls: ['./photo-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoUploadComponent {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private photo = inject(PhotoService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  form = this.fb.group({
    file: [null as File | null, [Validators.required]],
  });

  previewUrl = signal<string | null>(null);
  safePreview = signal<SafeUrl | null>(null);
  isUploading = signal(false);
  previewError = signal(false);
  objectUrl: string | null = null;
  fileInfo = signal<{ name: string; type: string; size: number } | null>(null);
  private triedDataUrlFallback = false;

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    this.form.patchValue({ file });
    if (file) {
      // Réinitialiser état précédent
      this.previewError.set(false);
      this.fileInfo.set({ name: file.name, type: file.type || 'inconnu', size: file.size });
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
      this.triedDataUrlFallback = false;

      // 1) Tenter un Object URL (rapide et compatible)
      try {
        this.objectUrl = URL.createObjectURL(file);
        this.previewUrl.set(this.objectUrl);
        this.safePreview.set(this.sanitizer.bypassSecurityTrustUrl(this.objectUrl));
      } catch {
        // 2) Fallback DataURL
        this.readAsDataUrl(file);
      }
    } else {
      this.previewUrl.set(null);
      this.safePreview.set(null);
      this.fileInfo.set(null);
      this.previewError.set(false);
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
    }
  }

  onPreviewError(): void {
    // Si l'aperçu via blob: échoue (CSP ou autre), tenter une fois le fallback DataURL
    const file = (this.form.value.file as File | null) || null;
    if (file && !this.triedDataUrlFallback) {
      this.triedDataUrlFallback = true;
      this.readAsDataUrl(file);
      return;
    }
    this.previewError.set(true);
  }

  onPreviewLoad(): void {
    this.previewError.set(false);
  }

  private readAsDataUrl(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      this.previewUrl.set(url);
      this.safePreview.set(url ? this.sanitizer.bypassSecurityTrustUrl(url) : null);
    };
    reader.onerror = () => {
      this.previewUrl.set(null);
      this.safePreview.set(null);
      this.previewError.set(true);
    };
    reader.readAsDataURL(file);
  }

  async submit(): Promise<void> {
    const file = this.form.value.file as File | null;
    if (!file) return;

    this.isUploading.set(true);
    try {
      const res = await this.photo.uploadGuestPhoto(file);
      this.snack.open('Photo envoyée pour modération', undefined, { duration: 3000 });
      // reset
      this.form.reset();
      this.previewUrl.set(null);
      this.safePreview.set(null);
      this.fileInfo.set(null);
      this.previewError.set(false);
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
    } catch (e: any) {
      console.error('Upload error', e);
      this.snack.open(e?.message || 'Échec de l\'upload', 'OK', { duration: 5000 });
    } finally {
      this.isUploading.set(false);
    }
  }
}
