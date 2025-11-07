import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  /**
   * Ouvre une boîte de confirmation et retourne une promesse résolue en true si confirmé.
   */
  confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data,
      disableClose: true,
      autoFocus: true,
    });
    return firstValueFrom(ref.afterClosed()).then((r) => !!r);
  }
}
