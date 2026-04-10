import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-post-login-welcome-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './post-login-welcome-dialog.component.html',
  styleUrls: ['./post-login-welcome-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostLoginWelcomeDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PostLoginWelcomeDialogComponent>);

  chooseGame(): void {
    this.dialogRef.close('game');
  }

  chooseClassic(): void {
    this.dialogRef.close('classic');
  }
}
