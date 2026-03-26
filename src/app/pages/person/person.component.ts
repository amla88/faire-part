import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { AuthService, PersonneSummary } from 'src/app/services/auth.service';
import { AvatarMacaronComponent } from 'src/app/shared/avatar-macaron/avatar-macaron.component';

@Component({
  selector: 'app-person-select',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule, AvatarMacaronComponent],
  templateUrl: './person.component.html',
  styleUrls: ['./person.component.scss'],
})
export class PersonComponent {
  personnes: PersonneSummary[] | undefined;

  constructor(public auth: AuthService, private router: Router) {
    const user = this.auth.getUser();
    this.personnes = user?.personnes;
  }

  select(p: PersonneSummary) {
    // use AuthService to persist selection and load avatar into cache
    this.auth.selectPerson(p.id).then(() => {
      this.router.navigate(['/']);
    }).catch((err) => {
      console.error('Erreur lors de la sélection de la personne', err);
      this.router.navigate(['/']);
    });
  }
}
