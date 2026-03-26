import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Router } from '@angular/router';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatButtonModule, MatCheckboxModule, MatDividerModule, MatIconModule, RouterModule],
  templateUrl: './rsvp.component.html',
  styleUrls: ['./rsvp.component.scss'],
})
export class RsvpComponent implements OnInit {
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loading = true;
  saving = false;
  personnes: Array<any> = [];

  form = this.fb.group({
    personnes: this.fb.array([])
  });

  get personnesArray() {
    return this.form.get('personnes') as FormArray;
  }

  ngOnInit(): void {
    this.loadPersonnes();
  }

  async loadPersonnes() {
    try {
      const user = this.auth.getUser();
      if (!user) {
        this.personnes = [];
        this.loading = false;
        return;
      }
      const familleId = user.famille_id;
      const client = this.supabase.getClient();
      const rpcRes: any = await client.rpc('get_personnes_by_famille', { p_famille_id: familleId });
      const data = rpcRes.data;
      const error = rpcRes.error;
      if (error) {
        console.warn('Erreur Supabase rpc get_personnes_by_famille:', error);
        this.personnes = [];
        return;
      }

      this.personnes = (data || []).map((r: any) => ({
        id: r.id,
        nom: r.nom,
        prenom: r.prenom,
        invite_reception: r.invite_reception ?? false,
        present_reception: r.present_reception ?? false,
        invite_repas: r.invite_repas ?? false,
        present_repas: r.present_repas ?? false,
        invite_soiree: r.invite_soiree ?? false,
        present_soiree: r.present_soiree ?? false,
      }));

      // build form array
      this.personnesArray.clear();
      for (const p of this.personnes) {
        this.personnesArray.push(this.fb.group({
          personne_id: [p.id, Validators.required],
          present_reception: [{ value: !!p.present_reception, disabled: !p.invite_reception }],
          present_repas: [{ value: !!p.present_repas, disabled: !p.invite_repas }],
          present_soiree: [{ value: !!p.present_soiree, disabled: !p.invite_soiree }],
        }));
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des personnes :', err);
      this.personnes = [];
    } finally {
      this.loading = false;
    }
  }

  async submit() {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const user = this.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');
      const familleId = user.famille_id;

      const payload = this.personnesArray.controls.map((c: any) => ({
        personne_id: c.value.personne_id,
        present_reception: !!c.value.present_reception,
        present_repas: !!c.value.present_repas,
        present_soiree: !!c.value.present_soiree,
      }));

      // Try RPC record_rsvp (recommended). If not available, attempt to call a generic upsert RPC.
      const client = this.supabase.getClient();
      const rpcRes: any = await client.rpc('record_rsvp', { p_famille_id: familleId, p_payload: payload });
      if (rpcRes.error) {
        console.warn('record_rsvp rpc failed, attempting alternative upsert', rpcRes.error);
        // fallback: try generic RPC 'upsert_rsvp' if exists
        const alt = await client.rpc('upsert_rsvp', { p_famille_id: familleId, p_payload: payload });
        if (alt.error) throw alt.error;
      }

      // success
      alert('Réponses enregistrées');
      this.router.navigateByUrl('/');
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde des réponses :', err);
      alert('Erreur lors de l\'enregistrement : ' + (err?.message || String(err)));
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.router.navigateByUrl('/');
  }
}
