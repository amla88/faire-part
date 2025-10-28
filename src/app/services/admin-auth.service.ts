import { Injectable, computed, effect, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { NgSupabaseService } from './ng-supabase.service';

export interface AdminProfile {
  id: string; // auth.users.id (uuid)
  role: 'admin' | 'invite';
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly supabase = this.sb.getClient();

  // Etat d'auth admin (Supabase Auth)
  readonly session = signal<Session | null>(null);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly profile = signal<AdminProfile | null>(null);
  readonly isAdmin = computed<boolean>(() => this.profile()?.role === 'admin');
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
      if (data.session?.user) {
        await this.loadProfile();
      }
      // Abonnement aux changements de session
      this.supabase.auth.onAuthStateChange(async (_event, sess) => {
        this.session.set(sess ?? null);
        if (sess?.user) {
          await this.loadProfile();
        } else {
          this.profile.set(null);
        }
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
      await this.loadProfile();
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
    this.profile.set(null);
  }

  private async loadProfile() {
    const u = this.session()?.user;
    if (!u) {
      this.profile.set(null);
      return;
    }
    // Lire son propre profil (policy déjà en place)
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, role')
      .eq('id', u.id)
      .maybeSingle();
    if (error) {
      // Pas de profil = rôle inconnu → traiter comme non-admin
      this.profile.set(null);
      return;
    }
    if (data) {
      this.profile.set({ id: data.id as string, role: (data.role as any) ?? 'invite' });
    } else {
      this.profile.set(null);
    }
  }
}
