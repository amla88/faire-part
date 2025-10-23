import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Galerie de Photos</h2><p>Galerie des photos approuvées</p></div>',
})
export class PhotosComponent {}
