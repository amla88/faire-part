import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { AuthService, PersonneSummary } from 'src/app/services/auth.service';

@Component({
  selector: 'app-person-select',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './person.component.html',
  styleUrls: ['./person.component.scss'],
})
export class PersonComponent {
  personnes: PersonneSummary[] | undefined;

  constructor(private auth: AuthService, private router: Router) {
    const user = this.auth.getUser();
    this.personnes = user?.personnes;
  }

  select(p: PersonneSummary) {
    // persist selection
    const user = this.auth.getUser();
    if (!user) return;
    user.selected_personne_id = p.id;
    localStorage.setItem('app_user', JSON.stringify(user));
    // navigate to dashboard
    this.router.navigate(['/']);
  }
}
