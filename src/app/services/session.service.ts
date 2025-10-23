import { Injectable } from '@angular/core';
import { NgSupabaseService } from './supabase.service';

interface Personne { id: number; nom?: string; prenom?: string; famille_id: number }
interface Famille { id: number; [k: string]: any }

@Injectable({ providedIn: 'root' })
export class SessionService {
  private uuid: string | null = null;
  private famille: Famille | null = null;
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
      const famille = await this.api.getFamilleByToken(this.uuid);
      if (!famille) { this.error = 'Famille introuvable'; return; }
      this.famille = famille as any;
      // Utiliser la RPC token-based pour contourner les RLS sur personnes
      this.personnes = await this.api.listPersonnesByToken(this.uuid);
      const stored = this.getStoredSelected(this.famille!.id);
      const byId = this.personnes.find(p => p.id === stored);
      this.selectedPersonneId = byId ? byId.id : (this.personnes[0]?.id ?? null);
      this.initialized = true;
    } catch (e: any) {
      this.error = e?.message || 'Erreur de session';
    }
  }

  getUuid() { return this.uuid; }
  getFamille() { return this.famille; }
  getSelectedPersonneId() { return this.selectedPersonneId; }

  setSelectedPersonneId(id: number) {
    this.selectedPersonneId = id;
    if (this.famille?.id) this.storeSelected(this.famille.id, id);
  }

  private key(familleId: number) { return `selected_personne_${familleId}`; }
  private storeSelected(familleId: number, personneId: number) { localStorage.setItem(this.key(familleId), String(personneId)); }
  private getStoredSelected(familleId: number): number | null {
    const v = localStorage.getItem(this.key(familleId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
