import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-photos',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Modération Photos</h2><p>Modération des propositions de photos</p></div>',
})
export class AdminPhotosComponent {}
