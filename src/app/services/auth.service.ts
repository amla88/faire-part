import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NgSupabaseService } from './ng-supabase.service';

export interface PersonneSummary {
  id: number;
  nom: string;
  prenom: string;
}

export interface AppUser {
  famille_id: number;
  personne_principale_id?: number;
  personnes?: PersonneSummary[];
  selected_personne_id?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly STORAGE_KEY = 'app_user';

  constructor(private supabase: NgSupabaseService, private router: Router) {}

  /** Valide le login_token côté DB et persiste l'objet user en localStorage */
  async loginWithToken(token: string): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('familles')
        .select('id, personne_principale')
        .eq('login_token', token)
        .single();

      if (error) {
        return { success: false, error: error.message || 'Erreur lors de la requête' };
      }

      if (!data) {
        return { success: false, error: 'Code invalide' };
      }

      // fetch personnes for this family
      const { data: personnesData, error: personnesError } = await client
        .from('personnes')
        .select('id,nom,prenom')
        .eq('famille_id', data.id);

      if (personnesError) {
        return { success: false, error: personnesError.message || 'Erreur lors de la récupération des personnes' };
      }

      const personnes: PersonneSummary[] = (personnesData || []).map((p: any) => ({ id: p.id, nom: p.nom, prenom: p.prenom }));

      const user: AppUser = {
        famille_id: data.id,
        personne_principale_id: data.personne_principale || undefined,
        personnes,
        selected_personne_id: personnes.length === 1 ? personnes[0].id : null,
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));

      // Perform navigation according to personnes count
      if (user.personnes && user.personnes.length > 1) {
        // multiple persons -> selection page
        this.router.navigate(['/person']);
      } else {
        // single or no persons -> go to root (dashboard)
        this.router.navigate(['/']);
      }

      return { success: true, user };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  getUser(): AppUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  }
}
