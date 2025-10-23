import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { NgSupabaseService } from '../services/supabase.service';
import { AdminStatsService } from '../services/admin-stats.service';

@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [CommonModule, FormsModule, RouterModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatTableModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent {
  users: any[] = [];
  loading = false;
  error = '';
  message = '';
  messageColor = 'green';
  newNom = '';
  newPrenom = '';
  adding = false;
  addedLink = '';
  stats: any = null;

  constructor(private api: NgSupabaseService, private statsApi: AdminStatsService) {
    this.loadUsers();
    this.loadStats();
  }

  personNames(u: any): string {
    const arr = Array.isArray(u?.personnes) ? u.personnes : [];
    return arr.map((p: any) => `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim()).filter(Boolean).join(', ');
  }

  async loadUsers() {
    this.loading = true; this.error = '';
    try {
      const { data, error } = await this.api.supabase
        .from('familles')
        .select(`id, login_token, personnes(id, nom, prenom)`) 
        .order('id', { ascending: true });
      if (error) throw error;
      this.users = data as any[];
    } catch (e: any) {
      this.error = e?.message || 'Erreur chargement utilisateurs';
    } finally {
      this.loading = false;
    }
  }

  async addUser() {
    this.addedLink = '';
    this.adding = true; this.error = '';
    try {
      const token = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { data: inserted, error } = await this.api.supabase
        .from('familles')
        .insert({ login_token: token })
        .select()
        .single();
      if (error) throw error;

      await this.api.supabase.from('personnes').insert({ nom: this.newNom, prenom: this.newPrenom, famille_id: inserted.id });
      const base = (document.baseURI || '/faire-part/').replace(/\/$/, '');
      this.addedLink = `${window.location.origin}/faire-part/game?uuid=${encodeURIComponent(inserted.login_token)}`;
      this.newNom = this.newPrenom = '';
      await this.loadUsers();
    } catch (e: any) {
      this.error = e?.message || 'Erreur ajout utilisateur';
    } finally {
      this.adding = false;
    }
  }

  async deleteUser(loginToken: string) {
    if (!confirm('Supprimer définitivement cet utilisateur ?')) return;
    try {
      const { data: user, error: userErr } = await this.api.supabase
        .from('familles')
        .select('id, auth_uuid')
        .eq('login_token', loginToken)
        .single();
      if (userErr) throw userErr;
      await this.api.supabase.from('personnes').delete().eq('famille_id', user.id);
      if ((user as any).auth_uuid) {
        await this.api.supabase.from('profiles').delete().eq('id', (user as any).auth_uuid);
      }
      await this.api.supabase.from('familles').delete().eq('login_token', loginToken);
      await this.loadUsers();
    } catch (e: any) {
      alert('Erreur lors de la suppression: ' + (e?.message || e));
    }
  }

  openGame(token: string) {
    const url = `${window.location.origin}/faire-part/game?uuid=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener');
  }

  async copyLink(token: string) {
    const url = `${window.location.origin}/faire-part/game?uuid=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      this.message = 'Lien copié dans le presse-papiers';
      this.messageColor = 'green';
      setTimeout(() => (this.message = ''), 2000);
    } catch {
      this.message = 'Impossible de copier. Sélectionne et copie manuellement: ' + url;
      this.messageColor = '#b00020';
    }
  }

  async loadStats() {
    try {
      this.stats = await this.statsApi.getStats();
    } catch (e: any) {
      console.warn('Stats indisponibles:', e?.message || e);
    }
  }
}
