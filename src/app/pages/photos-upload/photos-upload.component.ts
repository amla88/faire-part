import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-photos-upload',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="p-4"><h2>Upload de Photos</h2><p>Page d\'upload de photos souvenirs</p></div>',
})
export class PhotosUploadComponent {}
