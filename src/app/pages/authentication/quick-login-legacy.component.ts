import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Anciens liens / QR : /quick-login?token=… → route réelle /authentication/quick/:code
 */
@Component({
  selector: 'app-quick-login-legacy',
  standalone: true,
  template: '',
})
export class QuickLoginLegacyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    const token = (this.route.snapshot.queryParamMap.get('token') || '').trim();
    if (!token) {
      void this.router.navigate(['/authentication/login'], { replaceUrl: true });
      return;
    }
    void this.router.navigate(['/authentication', 'quick', token], { replaceUrl: true });
  }
}
