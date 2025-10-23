/**
 * Types et interfaces strictes pour l'application faire-part
 */

export interface Personne {
  id: number;
  nom?: string;
  prenom?: string;
  famille_id: number;
}

export interface Famille {
  id: number;
  nom_famille: string;
  note_admin?: string;
  personne_principale?: number;
}

export interface Invitation {
  id: number;
  famille_id: number;
  type_invitation: 'apero' | 'repas' | 'soiree' | 'combi';
  message?: string;
}

export interface User {
  id: number;
  famille_id: number;
  login_token: string;
  short_code?: string;
  token_expires_at?: string;
  last_login_at?: string;
}

export interface RSVP {
  id: number;
  famille_id: number;
  pour_apero: boolean;
  pour_repas: boolean;
  pour_soiree: boolean;
  contraintes_text?: string;
  updated_at: string;
}

export interface Avatar {
  id: number;
  personne_id: number;
  meta?: Record<string, unknown>;
}

export interface AvatarAsset {
  id: string;
  category: AvatarCategory;
  label: string;
  storage_path: string;
  depth: number;
  order_index: number;
  enabled: boolean;
}

export type AvatarCategory = 
  | 'skin' | 'hair_style' | 'hair_color' | 'eyes' | 'face_shape' | 'nose_shape' 
  | 'mouth_shape' | 'facial_hair' | 'accessory' | 'hat' | 'top' | 'bottom';

export interface AvatarAssetChoice {
  avatar_id: number;
  category: AvatarCategory;
  asset_id: string;
}

export interface Photo {
  id: number;
  famille_id: number;
  storage_path: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  caption?: string;
}

export interface Musique {
  id: number;
  famille_id: number;
  source: 'text' | 'spotify' | 'youtube' | 'deezer' | 'autre';
  value: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Room {
  id: number;
  slug: string;
  title: string;
  order_index: number;
}

export interface Dialogue {
  id: number;
  room_id: number;
  npx_id?: number;
  text: string;
  objective_id?: number;
  order_index: number;
}

export interface Objective {
  id: number;
  code: string;
  label: string;
  room_id: number;
  reward?: string;
}

export interface Player {
  id: number;
  user_id: number;
  save_data?: Record<string, unknown>;
}
