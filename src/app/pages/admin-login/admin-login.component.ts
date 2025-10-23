import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Connexion Admin</h2><p>Page de connexion admin</p></div>',
})
export class AdminLoginComponent {}
