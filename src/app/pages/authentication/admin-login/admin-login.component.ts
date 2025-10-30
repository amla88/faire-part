import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { AdminAuthService } from 'src/app/services/admin-auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-admin-login',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './admin-login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent {
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  readonly auth = inject(AdminAuthService);

  readonly form = new FormGroup({
    email: new FormControl('larive.amaury@gmail.com', [Validators.required, Validators.email]),
    password: new FormControl('cr3ui5n', [Validators.required, Validators.minLength(6)]),
  });

  get f() {
    return this.form.controls;
  }

  async submit() {
    if (this.form.invalid) return;
    const { email, password } = this.form.value as { email: string; password: string };
    const res = await this.auth.signIn(email, password);
    if (!res.success) {
      this.snack.open(this.auth.error() || 'Échec de la connexion', 'OK', { duration: 4000 });
      return;
    }
    if (!this.auth.isAdmin()) {
      this.snack.open('Accès réservé aux administrateurs', 'OK', { duration: 4000 });
      return;
    }
    await this.router.navigate(['/admin']);
  }
}
