import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Tableau Admin</h2><p>Tableau de bord administrateur avec liens et stats</p></div>',
})
export class AdminComponent {}
