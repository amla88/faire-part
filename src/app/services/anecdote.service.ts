import { Injectable } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';

export interface PersonneAnecdote {
  id: number;
  contenu: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AnecdoteService {
  constructor(private supabase: NgSupabaseService) {}

  private getToken(): string | null {
    try {
      return localStorage.getItem('app_token');
    } catch {
      return null;
    }
  }

  async listForPersonne(personneId: number): Promise<PersonneAnecdote[]> {
    const token = this.getToken();
    if (!token) return [];
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('list_anecdotes_for_token', {
      p_token: token,
      p_personne_id: personneId,
    });
    if (error) {
      console.error('list_anecdotes_for_token', error);
      throw new Error(error.message || 'Impossible de charger les anecdotes');
    }
    const rows = (data || []) as PersonneAnecdote[];
    return rows.map((r) => ({
      id: Number(r.id),
      contenu: String(r.contenu ?? ''),
      created_at: String(r.created_at ?? ''),
    }));
  }

  async insert(personneId: number, contenu: string): Promise<number | null> {
    const token = this.getToken();
    if (!token) return null;
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('insert_anecdote_for_token', {
      p_token: token,
      p_personne_id: personneId,
      p_contenu: contenu,
    });
    if (error) {
      console.error('insert_anecdote_for_token', error);
      throw new Error(error.message || 'Enregistrement impossible');
    }
    const id = data as number | null;
    return id != null ? Number(id) : null;
  }

  async delete(anecdoteId: number): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('delete_anecdote_for_token', {
      p_token: token,
      p_anecdote_id: anecdoteId,
    });
    if (error) {
      console.error('delete_anecdote_for_token', error);
      throw new Error(error.message || 'Suppression impossible');
    }
    return data === true;
  }
}
