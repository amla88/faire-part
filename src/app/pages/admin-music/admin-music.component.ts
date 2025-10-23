import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-music',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Modération Musiques</h2><p>Modération des propositions de musiques</p></div>',
})
export class AdminMusicComponent {}
