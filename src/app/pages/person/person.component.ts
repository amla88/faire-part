import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-person',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Sélection de Personne</h2><p>Page de sélection du membre de la famille</p></div>',
})
export class PersonComponent {}
