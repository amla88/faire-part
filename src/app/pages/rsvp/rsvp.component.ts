import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule, Router } from '@angular/router';
import { TextFieldModule } from '@angular/cdk/text-field';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { AvatarMacaronComponent } from 'src/app/shared/avatar-macaron/avatar-macaron.component';

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterModule,
    TextFieldModule,
    AvatarMacaronComponent,
  ],
  templateUrl: './rsvp.component.html',
  styleUrls: ['./rsvp.component.scss'],
})
export class RsvpComponent implements OnInit {
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);
  private avatar = inject(AvatarService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

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
        decline_invitation: r.decline_invitation ?? false,
        allergenes_alimentaires: r.allergenes_alimentaires ?? '',
        regimes_remarques: r.regimes_remarques ?? '',
      }));

      /* Hydrater le cache image pour chaque personne (la connexion ne pré-remplit pas toujours
       * imageDataUri pour toute la famille — seulement ce qui est déjà en mémoire). */
      const ids = this.personnes
        .map((p) => Number(p.id))
        .filter((n) => Number.isFinite(n));
      await Promise.all(ids.map((id) => this.avatar.loadAvatarFromRpc(id).catch(() => null)));

      // build form array
      this.personnesArray.clear();
      for (const p of this.personnes) {
        const g = this.fb.group({
          personne_id: [p.id, Validators.required],
          decline_invitation: [!!p.decline_invitation],
          present_reception: [{ value: !!p.present_reception, disabled: !p.invite_reception }],
          present_repas: [{ value: !!p.present_repas, disabled: !p.invite_repas }],
          present_soiree: [{ value: !!p.present_soiree, disabled: !p.invite_soiree }],
          allergenes_alimentaires: [p.allergenes_alimentaires || '', [Validators.maxLength(2000)]],
          regimes_remarques: [p.regimes_remarques || '', [Validators.maxLength(2000)]],
        });
        this.personnesArray.push(g);

        g.get('decline_invitation')?.valueChanges.subscribe((decl: boolean) => {
          this.applyDeclineToRow(g, p, !!decl);
        });

        const clearDeclineIfAnyPresent = (): void => {
          const v = g.getRawValue() as {
            present_reception?: boolean;
            present_repas?: boolean;
            present_soiree?: boolean;
            decline_invitation?: boolean;
          };
          if (v.present_reception || v.present_repas || v.present_soiree) {
            if (v.decline_invitation) {
              g.patchValue({ decline_invitation: false }, { emitEvent: true });
            }
          }
        };
        g.get('present_reception')?.valueChanges.subscribe(clearDeclineIfAnyPresent);
        g.get('present_repas')?.valueChanges.subscribe(clearDeclineIfAnyPresent);
        g.get('present_soiree')?.valueChanges.subscribe(clearDeclineIfAnyPresent);

        if (p.decline_invitation) {
          this.applyDeclineToRow(g, p, true);
        }
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

      const payload = this.personnesArray.controls.map((c) => {
        const v = (c as FormGroup).getRawValue();
        return {
          personne_id: v.personne_id,
          decline_invitation: !!v.decline_invitation,
          present_reception: !!v.present_reception,
          present_repas: !!v.present_repas,
          present_soiree: !!v.present_soiree,
          allergenes_alimentaires: (v.allergenes_alimentaires ?? '').trim(),
          regimes_remarques: (v.regimes_remarques ?? '').trim(),
        };
      });

      // Try RPC record_rsvp (recommended). If not available, attempt to call a generic upsert RPC.
      const client = this.supabase.getClient();
      const rpcRes: any = await client.rpc('record_rsvp', { p_famille_id: familleId, p_payload: payload });
      if (rpcRes.error) {
        console.warn('record_rsvp rpc failed, attempting alternative upsert', rpcRes.error);
        // fallback: try generic RPC 'upsert_rsvp' if exists
        const alt = await client.rpc('upsert_rsvp', { p_famille_id: familleId, p_payload: payload });
        if (alt.error) throw alt.error;
      }

      this.snack.open(
        'Vos réponses ont été consignées avec grâce dans le registre du domaine.',
        undefined,
        { duration: 4000 }
      );
      this.router.navigateByUrl('/');
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde des réponses :', err);
      this.snack.open(
        'Erreur lors de l’enregistrement : ' + (err?.message || String(err)),
        'OK',
        { duration: 6000 }
      );
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    this.router.navigateByUrl('/');
  }

  /**
   * Refus : aucune présence ni infos banquet ; sinon réactive les contrôles selon les invitations.
   */
  private applyDeclineToRow(
    g: FormGroup,
    p: { invite_reception: boolean; invite_repas: boolean; invite_soiree: boolean },
    declined: boolean
  ): void {
    if (declined) {
      g.patchValue(
        {
          present_reception: false,
          present_repas: false,
          present_soiree: false,
          allergenes_alimentaires: '',
          regimes_remarques: '',
        },
        { emitEvent: false }
      );
      g.get('present_reception')?.disable({ emitEvent: false });
      g.get('present_repas')?.disable({ emitEvent: false });
      g.get('present_soiree')?.disable({ emitEvent: false });
      g.get('allergenes_alimentaires')?.disable({ emitEvent: false });
      g.get('regimes_remarques')?.disable({ emitEvent: false });
      return;
    }

    if (p.invite_reception) g.get('present_reception')?.enable({ emitEvent: false });
    else g.get('present_reception')?.disable({ emitEvent: false });

    if (p.invite_repas) g.get('present_repas')?.enable({ emitEvent: false });
    else g.get('present_repas')?.disable({ emitEvent: false });

    if (p.invite_soiree) g.get('present_soiree')?.enable({ emitEvent: false });
    else g.get('present_soiree')?.disable({ emitEvent: false });

    if (p.invite_repas) {
      g.get('allergenes_alimentaires')?.enable({ emitEvent: false });
      g.get('regimes_remarques')?.enable({ emitEvent: false });
    } else {
      g.get('allergenes_alimentaires')?.disable({ emitEvent: false });
      g.get('regimes_remarques')?.disable({ emitEvent: false });
    }
  }

  /** Data URI affichable pour le macaron (cache hydraté par loadAvatarFromRpc). */
  macaronAvatarUri(p: { id: number | string | bigint }): string | null {
    const pid = Number(p.id);
    if (!Number.isFinite(pid)) return null;
    const raw = this.avatar.getAvatarDataUri(pid);
    const s = raw != null ? String(raw).trim() : '';
    return s.length > 0 ? s : null;
  }
}
