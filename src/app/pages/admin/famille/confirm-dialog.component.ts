import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { 
  MatDialogModule, 
  MatDialogRef, 
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogTitle,
  MatDialogContent
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatButtonModule, 
    MatIconModule
  ],
  template: `
    <h5 mat-dialog-title class="mat-subtitle-1 d-flex align-items-center">
      <mat-icon [class]="data.isDanger ? 'text-error' : 'text-warning'" class="m-r-8">
        {{ data.isDanger ? 'warning' : 'help_outline' }}
      </mat-icon>
      {{ data.title }}
    </h5>
    <div mat-dialog-content class="f-s-14 lh-16 p-t-8">
      {{ data.message }}
    </div>
    <div mat-dialog-actions class="p-24 p-t-0 d-flex justify-end gap-8">
      <button mat-flat-button mat-dialog-close class="m-r-8">
        {{ data.cancelText || 'Annuler' }}
      </button>
      <button 
        mat-flat-button 
        [mat-dialog-close]="true" 
        [class]="data.isDanger ? 'bg-error text-white' : 'bg-primary text-white'"
        cdkFocusInitial>
        {{ data.confirmText || 'Confirmer' }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>, 
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}
}
