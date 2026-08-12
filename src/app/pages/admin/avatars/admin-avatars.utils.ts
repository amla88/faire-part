import { AvatarService } from 'src/app/services/avatar.service';

export const AVATAR_PLACEHOLDER_SRC = 'assets/images/avatar-sans-avatar.svg';

export interface AdminAvatarRow {
  id?: number;
  seed?: string | null;
  options?: unknown;
  generated_by_admin?: boolean;
}

export function isAdminGeneratedAvatar(avatar: AdminAvatarRow | null | undefined): boolean {
  return avatar?.generated_by_admin === true;
}

export function canAdminGenerateAvatar(avatar: AdminAvatarRow | null | undefined): boolean {
  return !hasAvatarConfig(avatar);
}

export function hasAvatarConfig(avatar: AdminAvatarRow | null | undefined): boolean {
  if (!avatar) return false;
  const seed = avatar.seed != null ? String(avatar.seed).trim() : '';
  if (seed.length > 0) return true;
  if (avatar.options && typeof avatar.options === 'object' && !Array.isArray(avatar.options)) {
    return Object.keys(avatar.options as object).length > 0;
  }
  return false;
}

export function resolveAvatarDataUri(
  avatar: AdminAvatarRow | null | undefined,
  avatarService: AvatarService
): string | null {
  if (!hasAvatarConfig(avatar)) return null;
  const opts = avatar!.options ?? { seed: avatar!.seed };
  return avatarService.generateDataUri(opts);
}

export function avatarDisplaySrc(
  dataUri: string | null | undefined,
  placeholder = AVATAR_PLACEHOLDER_SRC
): string {
  const t = dataUri != null ? String(dataUri).trim() : '';
  return t.length > 0 ? t : placeholder;
}

export function normalizeAvatarFromPersonne(raw: unknown): AdminAvatarRow | null {
  if (raw == null) return null;
  const avatarsRaw = (raw as { avatars?: unknown }).avatars;
  if (avatarsRaw == null) return null;
  const row = Array.isArray(avatarsRaw) ? avatarsRaw[0] : avatarsRaw;
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  return {
    id: o['id'] != null ? Number(o['id']) : undefined,
    seed: (o['seed'] as string | null) ?? null,
    options: o['options'],
    generated_by_admin: o['generated_by_admin'] === true,
  };
}

export function getFamilyDisplayName(famille: {
  id: number;
  personne_principale?: number | null;
  personnes?: { id: number; prenom?: string; nom?: string }[];
}): string {
  const personnes = Array.isArray(famille.personnes) ? famille.personnes : [];
  const principaleId = famille.personne_principale;
  let principale = principaleId != null ? personnes.find((p) => Number(p.id) === Number(principaleId)) : null;
  if (!principale && personnes.length > 0) principale = personnes[0];
  if (principale) {
    return `Famille ${principale.prenom ?? ''} ${principale.nom ?? ''}`.trim();
  }
  return `Famille #${famille.id}`;
}
