import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Proposer des Musiques</h2><p>Page de proposition de musiques</p></div>',
})
export class MusicComponent {}
