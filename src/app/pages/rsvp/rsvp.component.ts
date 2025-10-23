import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>RSVP</h2><p>Page de confirmation de présence</p></div>',
})
export class RsvpComponent {}
