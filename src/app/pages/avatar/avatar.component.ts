import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Éditeur d\'Avatar</h2><p>Page d\'édition de l\'avatar personnel</p></div>',
})
export class AvatarComponent {}
