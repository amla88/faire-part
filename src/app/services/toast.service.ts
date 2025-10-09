import { Injectable } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts: Toast[] = [];
  private seq = 1;

  show(text: string, type: Toast['type'] = 'info', ms = 2500) {
    const id = this.seq++;
    const t: Toast = { id, text, type };
    this.toasts = [...this.toasts, t];
    if (ms > 0) setTimeout(() => this.dismiss(id), ms);
  }

  success(text: string, ms = 2500) { this.show(text, 'success', ms); }
  error(text: string, ms = 3000) { this.show(text, 'error', ms); }
  info(text: string, ms = 2500) { this.show(text, 'info', ms); }

  dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
