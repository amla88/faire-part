import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-assets',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Gestion des Assets Avatar</h2><p>Gestion des assets d\'avatar</p></div>',
})
export class AdminAssetsComponent {}
