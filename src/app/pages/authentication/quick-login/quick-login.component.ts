import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-quick-login',
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './quick-login.component.html',
  styleUrls: ['./quick-login.component.scss'],
})
export class AppQuickLoginComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const raw = (this.route.snapshot.paramMap.get('code') || '').toString();
      const token = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!/^[A-Z0-9]{8}$/.test(token)) {
        // invalid format -> go to normal login
        this.router.navigate(['/authentication/login']);
        return;
      }

      const res = await this.auth.loginWithToken(token);

      if (!res.success) {
        this.snackBar.open(res.error || 'Code invalide', 'OK', { duration: 4000 });
        // ensure user lands on the login form
        this.router.navigate(['/authentication/login']);
      }

      // on success, AuthService already navigates to the appropriate page (root or /person)
      // navigation removes the quick code from the URL.
    } catch (e: any) {
      this.snackBar.open(e?.message || 'Erreur lors de la connexion', 'OK', { duration: 4000 });
      this.router.navigate(['/authentication/login']);
    }
  }
}
