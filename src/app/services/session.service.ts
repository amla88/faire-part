import { Injectable } from '@angular/core';
import { NgSupabaseService } from './supabase.service';

interface Personne { id: number; nom?: string; prenom?: string; user_id: number }
interface User { id: number; [k: string]: any }

@Injectable({ providedIn: 'root' })
export class SessionService {
  private uuid: string | null = null;
  private user: User | null = null;
  personnes: Personne[] = [];
  selectedPersonneId: number | null = null;
  initialized = false;
  error: string | null = null;

  constructor(private api: NgSupabaseService) {}

  private readUuid(): string | null {
    const url = new URL(window.location.href);
    // 1) Essayer dans la query avant le hash
    const fromQuery = url.searchParams.get('uuid');
    if (fromQuery) {
      localStorage.setItem('login_uuid', fromQuery);
      return fromQuery;
    }
    // 2) Essayer dans la partie hash (ex: #/avatar?uuid=XXXX)
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex >= 0) {
      const qs = hash.substring(qIndex + 1);
      const sp = new URLSearchParams(qs);
      const fromHash = sp.get('uuid');
      if (fromHash) {
        localStorage.setItem('login_uuid', fromHash);
        return fromHash;
      }
    }
    // 3) Sinon, localStorage
    return localStorage.getItem('login_uuid');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      this.uuid = this.readUuid();
      if (!this.uuid) { this.error = 'Aucun token de connexion'; return; }
      const user = await this.api.getUserByToken(this.uuid);
      if (!user) { this.error = 'Utilisateur introuvable'; return; }
  this.user = user as any;
  this.personnes = await this.api.listPersonnesByUserId(this.user!.id);
  const stored = this.getStoredSelected(this.user!.id);
      const byId = this.personnes.find(p => p.id === stored);
      this.selectedPersonneId = byId ? byId.id : (this.personnes[0]?.id ?? null);
      this.initialized = true;
    } catch (e: any) {
      this.error = e?.message || 'Erreur de session';
    }
  }

  getUuid() { return this.uuid; }
  getUser() { return this.user; }
  getSelectedPersonneId() { return this.selectedPersonneId; }

  setSelectedPersonneId(id: number) {
    this.selectedPersonneId = id;
    if (this.user?.id) this.storeSelected(this.user.id, id);
  }

  private key(userId: number) { return `selected_personne_${userId}`; }
  private storeSelected(userId: number, personneId: number) { localStorage.setItem(this.key(userId), String(personneId)); }
  private getStoredSelected(userId: number): number | null {
    const v = localStorage.getItem(this.key(userId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
