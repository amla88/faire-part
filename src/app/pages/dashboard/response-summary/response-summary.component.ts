import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-response-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './response-summary.component.html',
  styleUrls: ['./response-summary.component.scss'],
})
export class ResponseSummaryComponent implements OnInit {
  private supabase = inject(NgSupabaseService);
  private auth = inject(AuthService);
  private cd = inject(ChangeDetectorRef);

  loading = true;
  personnes: Array<any> = [];
  showReceptionHeader = false;
  showRepasHeader = false;
  showSoireeHeader = false;

  public isTrue(v: any): boolean {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  /** Indique si des notes culinaires ont été laissées au registre. */
  hasDietaryNotes(p: any): boolean {
    const a = String(p?.allergenes_alimentaires ?? '').trim();
    const r = String(p?.regimes_remarques ?? '').trim();
    return a.length > 0 || r.length > 0;
  }

  async ngOnInit(): Promise<void> {
    try {
      const user = this.auth.getUser();
      if (!user) {
        this.personnes = [];
        return;
      }

      const familleId = user.famille_id;
      const client = this.supabase.getClient();

      // Use the SECURITY DEFINER RPC to fetch personnes for the famille
      // This avoids RLS blocking a direct SELECT when using anon key.
      const rpcRes: any = await client.rpc('get_personnes_by_famille', { p_famille_id: familleId });
      const data = rpcRes.data;
      const error = rpcRes.error;

      if (error) {
        console.warn('Erreur Supabase rpc get_personnes_by_famille:', error);
        this.personnes = [];
        return;
      }

      // RPC may return only id/nom/prenom; ensure invite_/present_ fields exist with defaults.
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
      // Compute which headers should be shown: at least one personne invited.
      this.showReceptionHeader = this.personnes.some((pp: any) => this.isTrue(pp.invite_reception));
      this.showRepasHeader = this.personnes.some((pp: any) => this.isTrue(pp.invite_repas));
      this.showSoireeHeader = this.personnes.some((pp: any) => this.isTrue(pp.invite_soiree));
    } catch (err) {
      console.error('Erreur lors de la récupération des personnes :', err);
      this.personnes = [];
    } finally {
      this.loading = false;
      // Ensure view updates even if host uses OnPush
      try { this.cd.detectChanges(); } catch {}
    }
  }
}
