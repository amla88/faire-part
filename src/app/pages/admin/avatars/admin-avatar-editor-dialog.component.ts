import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AvatarEditorComponent } from 'src/app/pages/avatar/avatar-editor.component';

export interface AdminAvatarEditorDialogData {
  personneId: number;
  prenom: string;
  nom: string;
  seed?: string | null;
  options?: Record<string, unknown> | null;
}

export type AdminAvatarEditorDialogResult = { saved: true } | undefined;

@Component({
  selector: 'app-admin-avatar-editor-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, AvatarEditorComponent],
  templateUrl: './admin-avatar-editor-dialog.component.html',
  styleUrls: ['./admin-avatar-editor-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAvatarEditorDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<
      AdminAvatarEditorDialogComponent,
      AdminAvatarEditorDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) readonly data: AdminAvatarEditorDialogData
  ) {}

  onSaved(): void {
    this.dialogRef.close({ saved: true });
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
