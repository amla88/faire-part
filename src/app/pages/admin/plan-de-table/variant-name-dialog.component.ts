import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface VariantNameDialogData {
  title: string;
  defaultName: string;
  confirmLabel: string;
}

@Component({
  selector: 'app-variant-name-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="variant-name-field" subscriptSizing="dynamic">
        <mat-label>Nom de la variante</mat-label>
        <input
          matInput
          [(ngModel)]="name"
          (keydown.enter)="submit($event)"
          autofocus
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Annuler</button>
      <button mat-flat-button type="button" color="primary" (click)="submit()">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .variant-name-field {
        width: 100%;
        margin-top: 4px;
      }
    `,
  ],
})
export class VariantNameDialogComponent {
  name: string;

  constructor(
    private dialogRef: MatDialogRef<VariantNameDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: VariantNameDialogData
  ) {
    this.name = data.defaultName;
  }

  submit(ev?: Event) {
    ev?.preventDefault();
    this.dialogRef.close(this.name.trim());
  }
}
