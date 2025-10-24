import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-side-login',
  imports: [CommonModule, RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  loading = false;
  errorMessage = '';

  form = new FormGroup({
    token: new FormControl('', [Validators.required, Validators.minLength(8), Validators.maxLength(8), Validators.pattern('^[A-Z0-9]+$')]),
  });

  ngOnInit(): void {
    // Force uppercase and strip invalid characters as the user types
    const control = this.form.get('token');
    control?.valueChanges.subscribe((v) => {
      if (typeof v === 'string') {
        const up = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (up !== v) {
          control.setValue(up, { emitEvent: false });
        }
      }
    });
  }

  constructor(private router: Router, private auth: AuthService, private snackBar: MatSnackBar) {}

  get f() {
    return this.form.controls;
  }

  async submit() {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.errorMessage = 'Veuillez saisir le code d\'accès (8 caractères).';
      return;
    }

    const token = this.form.value.token as string;
    this.loading = true;
    const res = await this.auth.loginWithToken(token);
    this.loading = false;

    if (!res.success) {
      this.errorMessage = res.error || 'Code invalide';
      this.snackBar.open(this.errorMessage, 'OK', { duration: 4000 });
      return;
    }

    // Login réussi: show welcome message only when appropriate:
    // - if the family has a single person -> show immediately
    // - if multiple persons exist -> show only when a person is already selected
    const user = res.user;
    let display = '';
    let shouldShow = false;

    if (user) {
      const personnes = user.personnes ?? [];
      if (personnes.length === 1) {
        // single member: show welcome
        shouldShow = true;
        display = `${personnes[0].prenom} ${personnes[0].nom}`;
      } else if (user.selected_personne_id) {
        // multiple members but a selection exists already
        const match = personnes.find((p) => p.id === user.selected_personne_id);
        if (match) {
          shouldShow = true;
          display = `${match.prenom} ${match.nom}`;
        }
      }
    }

    if (shouldShow) {
      this.snackBar.open(`Bienvenue ${display}`, 'OK', { duration: 2000 });
    }
  }
}
