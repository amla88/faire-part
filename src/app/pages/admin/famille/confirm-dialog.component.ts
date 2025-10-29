import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-body">
        <mat-icon class="confirm-icon">warning</mat-icon>
        <div>
          <h3 class="m-0">{{ data?.title || 'Confirmer' }}</h3>
          <p class="m-0">{{ data?.message || '' }}</p>
        </div>
      </div>
      <div class="confirm-actions">
        <button mat-stroked-button (click)="onClose(false)">Annuler</button>
        <button mat-flat-button color="warn" (click)="onClose(true)">Confirmer</button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirm-body { display:flex; gap:12px; align-items:center; }
      .confirm-icon { font-size:36px; color:var(--warn, #d32f2f); }
      .confirm-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  constructor(private dialogRef: MatDialogRef<ConfirmDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {}

  onClose(ok: boolean) {
    this.dialogRef.close(ok);
  }
}
