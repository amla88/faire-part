import { Component, input, signal, computed, effect, untracked } from '@angular/core';

/**
 * Macaron : initiales toujours visibles en fond ; image par-dessus si disponible.
 * Si l’image échoue (404, etc.), retour automatique aux initiales.
 */
@Component({
  selector: 'app-avatar-macaron',
  standalone: true,
  imports: [],
  templateUrl: './avatar-macaron.component.html',
  styleUrls: ['./avatar-macaron.component.scss'],
})
export class AvatarMacaronComponent {
  /** Data URI, URL https, ou chemin assets — vide = uniquement les initiales */
  imageSrc = input<string | null | undefined>(null);
  prenom = input<string>('');
  nom = input<string>('');
  size = input<number>(36);

  private loadFailed = signal(false);

  constructor() {
    effect(() => {
      this.imageSrc();
      untracked(() => this.loadFailed.set(false));
    });
  }

  initials = computed(() => {
    const a = (this.prenom() || '').trim().charAt(0) || '';
    const b = (this.nom() || '').trim().charAt(0) || '';
    const s = `${a}${b}`;
    return s.length > 0 ? s : '?';
  });

  showImage = computed(() => {
    const src = this.imageSrc();
    const t = src != null ? String(src).trim() : '';
    return t.length > 0 && !this.loadFailed();
  });

  onImgError(): void {
    this.loadFailed.set(true);
  }
}
