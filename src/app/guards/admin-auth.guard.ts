import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { NgSupabaseService } from '../services/supabase.service';

export async function adminGuard(): Promise<boolean | UrlTree> {
  const router = inject(Router);
  const api = inject(NgSupabaseService);
  try {
    const { data } = await api.supabase.auth.getSession();
    if (data?.session) return true;
  } catch {}
  return router.parseUrl('/admin-login');
}
