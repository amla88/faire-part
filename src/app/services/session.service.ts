import { Injectable } from '@angular/core';
import { SupabaseApiService } from './supabase/supabase-api.service';

interface Personne { id: number; nom?: string; prenom?: string; famille_id: number }
interface Famille { id: number; [k: string]: any }

/**
 * Service Angular pour gérer l'état de session utilisateur.
 * Coordonne l'authentification, la sélection de personne et la persistance locale.
 */

@Injectable({ providedIn: 'root' })
export class SessionService {
  private uuid: string | null = null;
  private famille: Famille | null = null;
  personnes: Personne[] = [];
  selectedPersonneId: number | null = null;
  initialized = false;
  error: string | null = null;

  constructor(private api: SupabaseApiService) {}

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
      // Sélectionner la première personne en session
      this.selectedPersonneId = this.personnes[0]?.id ?? null;
      this.initialized = true;
    } catch (e: any) {
      this.error = e?.message || 'Erreur de session';
    }
  }

  getUuid() { return this.uuid; }
  getFamille() { return this.famille; }
  getSelectedPersonneId() { return this.selectedPersonneId; }
  getSelectedPersonne(): Personne | null {
    if (this.selectedPersonneId === null) return null;
    return this.personnes.find(p => p.id === this.selectedPersonneId) ?? null;
  }
  getPersonnePrincipale(): Personne | null {
    if (!this.famille?.['personne_principale']) return null;
    return this.personnes.find(p => p.id === this.famille!['personne_principale']) ?? null;
  }

  setSelectedPersonneId(id: number) {
    this.selectedPersonneId = id;
    // La personne sélectionnée reste en session, pas en localStorage
  }

  private key(familleId: number) { return `selected_personne_${familleId}`; }
  private storeSelected(familleId: number, personneId: number) { localStorage.setItem(this.key(familleId), String(personneId)); }
  private getStoredSelected(familleId: number): number | null {
    const v = localStorage.getItem(this.key(familleId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  logout(): void {
    try { localStorage.removeItem('login_uuid'); } catch {}
    this.uuid = null;
    this.famille = null;
    this.personnes = [];
    this.selectedPersonneId = null;
    this.initialized = false;
    this.error = null;
  }
}
