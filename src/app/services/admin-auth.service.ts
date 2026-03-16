import { Injectable, computed, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { NgSupabaseService } from './ng-supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly supabase = this.sb.getClient();

  // Etat d'auth admin (Supabase Auth)
  readonly session = signal<Session | null>(null);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly isAdmin = computed<boolean>(() => this.user() !== null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor(private sb: NgSupabaseService) {
    // Charger la session à l'init et s'abonner aux changements
    this.init();
  }

  private async init() {
    try {
      const { data } = await this.supabase.auth.getSession();
      this.session.set(data.session ?? null);
      
      // Abonnement aux changements de session
      this.supabase.auth.onAuthStateChange((_event, sess) => {
        this.session.set(sess ?? null);
      });
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur d\'initialisation de la session');
    }
  }

  async signIn(email: string, password: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.session.set(data.session ?? null);
      return { success: true } as const;
    } catch (e: any) {
      const msg = e?.message || 'Identifiants invalides';
      this.error.set(msg);
      return { success: false, error: msg } as const;
    } finally {
      this.loading.set(false);
    }
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.session.set(null);
  }
}
