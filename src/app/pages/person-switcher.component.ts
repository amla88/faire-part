import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SessionService } from '../services/session.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-person-switcher',
  imports: [CommonModule, FormsModule, RouterModule, MatCardModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  templateUrl: './person-switcher.component.html',
  styleUrls: ['./person-switcher.component.css']
})
export class PersonSwitcherComponent {
  ready = false;
  error = '';
  personnes: Array<{ id: number; nom?: string; prenom?: string }> = [];
  selected: number | null = null;

  constructor(private session: SessionService, private router: Router) {
    this.init();
  }

  async init() {
    await this.session.init();
    this.error = this.session.error || '';
    this.personnes = this.session.personnes;
    this.selected = this.session.getSelectedPersonneId();
    this.ready = true;
  }

  applyAndGo(path: string) {
    if (this.selected != null) this.session.setSelectedPersonneId(this.selected);
    this.router.navigateByUrl(path);
  }
}
