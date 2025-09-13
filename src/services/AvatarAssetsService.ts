import { supabase } from "./supabaseClient";

export type AvatarCategory =
  | "skin"
  | "hair_style"
  | "hair_color"
  | "eyes"
  | "face_shape"
  | "nose_shape"
  | "mouth_shape"
  | "facial_hair"
  | "accessory"
  | "hat"
  | "top"
  | "bottom";

export interface AvatarAsset {
  id: string;
  category: AvatarCategory;
  label: string;
  storage_path: string;
  order_index: number;
  depth: number; // 0..99, default 50
  width?: number | null;
  height?: number | null;
  enabled?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

const BUCKET = "avatar-assets";

export const AvatarCategories: { id: AvatarCategory; label: string }[] = [
  { id: "skin", label: "Couleur/Peau" },
  { id: "face_shape", label: "Forme de visage" },
  { id: "eyes", label: "Yeux" },
  { id: "nose_shape", label: "Nez" },
  { id: "mouth_shape", label: "Bouche" },
  { id: "hair_style", label: "Coupe de cheveux" },
  { id: "hair_color", label: "Couleur des cheveux" },
  { id: "facial_hair", label: "Pilosité" },
  { id: "accessory", label: "Accessoires" },
  { id: "hat", label: "Chapeau" },
  { id: "top", label: "Haut" },
  { id: "bottom", label: "Bas" },
];

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function listAssets(category?: AvatarCategory): Promise<AvatarAsset[]> {
  let query = supabase.from("avatar_assets").select("*").order("order_index", { ascending: true });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return (data as AvatarAsset[]) || [];
}

export async function createAsset(params: {
  file: File;
  category: AvatarCategory;
  label: string;
  order_index?: number;
  depth?: number; // default 50
}): Promise<AvatarAsset> {
  const { file, category, label } = params;
  const order_index = params.order_index ?? 0;
  const depth = params.depth ?? 50;
  const ext = file.name.split(".").pop() || "png";
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${category}/${filename}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("avatar_assets")
    .insert({ category, label, storage_path: path, order_index, depth })
    .select("*")
    .single();
  if (error) throw error;
  return data as AvatarAsset;
}

export async function updateAsset(id: string, patch: Partial<Omit<AvatarAsset, "id" | "storage_path">>): Promise<AvatarAsset> {
  const { data, error } = await supabase
    .from("avatar_assets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as AvatarAsset;
}

export async function replaceAssetFile(id: string, currentPath: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const folder = currentPath.split("/")[0];
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const newPath = `${folder}/${filename}`;

  // Upload nouveau fichier
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  // Optionnel: supprimer l'ancien fichier
  if (currentPath) await supabase.storage.from(BUCKET).remove([currentPath]);

  // Mettre à jour le chemin en DB
  const { error } = await supabase.from("avatar_assets").update({ storage_path: newPath }).eq("id", id);
  if (error) throw error;
  return newPath;
}

export async function deleteAsset(id: string, storagePath: string): Promise<void> {
  await supabase.from("avatar_assets").delete().eq("id", id);
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]);
}

export async function moveAssetToCategory(
  id: string,
  currentPath: string,
  newCategory: AvatarCategory
): Promise<string> {
  const filename = currentPath.split("/").pop() || `${id}.png`;
  const newPath = `${newCategory}/${filename}`;
  if (newPath === currentPath) return currentPath;
  const { error: mvErr } = await supabase.storage.from(BUCKET).move(currentPath, newPath);
  if (mvErr) throw mvErr;
  const { error } = await supabase
    .from("avatar_assets")
    .update({ storage_path: newPath, category: newCategory })
    .eq("id", id);
  if (error) throw error;
  return newPath;
}
