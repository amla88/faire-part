import { supabase } from "./supabaseClient";
import type { AvatarCategory } from "./AvatarAssetsService";

export interface AvatarRow {
  id: number;
  personne_id: number;
}

export async function ensureAvatarForPersonne(personne_id: string | number): Promise<AvatarRow> {
  const pid = typeof personne_id === "string" ? parseInt(personne_id, 10) : personne_id;
  // Try RPC first (bypasses RLS via SECURITY DEFINER)
  const rpc = await supabase.rpc("ensure_avatar_for_personne", { p_personne_id: pid });
  if (!rpc.error && rpc.data) return rpc.data as AvatarRow;
  // Fallback to read-only path (may fail due to RLS)
  const { data: found, error: selErr } = await supabase
    .from("avatars")
    .select("id, personne_id")
    .eq("personne_id", pid)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!found) throw new Error("Avatar introuvable et RPC indisponible");
  return found as AvatarRow;
}

export async function getChoices(avatar_id: number): Promise<Array<{ category: AvatarCategory; asset_id: string }>> {
  const { data, error } = await supabase
    .from("avatar_asset_choices")
    .select("category, asset_id")
    .eq("avatar_id", avatar_id);
  if (error) throw error;
  return (data as any[]) as Array<{ category: AvatarCategory; asset_id: string }>;
}

export async function upsertChoices(
  avatar_id: number,
  selections: Partial<Record<AvatarCategory, string>>
): Promise<void> {
  const rows = Object.entries(selections)
    .filter(([, v]) => !!v)
    .map(([category, asset_id]) => ({ avatar_id, category, asset_id }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("avatar_asset_choices")
    .upsert(rows as any, { onConflict: "avatar_id,category" });
  if (error) throw error;
}

export async function upsertChoicesRPC(
  personne_id: string | number,
  selections: Partial<Record<AvatarCategory, string>>
): Promise<void> {
  const pid = typeof personne_id === "string" ? parseInt(personne_id, 10) : personne_id;
  const { error } = await supabase.rpc("upsert_avatar_choices", {
    p_personne_id: pid,
    p_selections: selections as any,
  });
  if (error) throw error;
}
