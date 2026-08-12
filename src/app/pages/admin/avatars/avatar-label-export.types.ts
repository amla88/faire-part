export const DEFAULT_LABEL_BACKGROUND = 'assets/images/labels/etiquette-fond-bridgerton.png';
export const WEDDING_LOGO_SRC = 'assets/images/logos/logo.png';
export const DEFAULT_WEDDING_DATE = '12 septembre 2026';
export const DEFAULT_LABEL_WIDTH_MM = 60;
export const DEFAULT_LABEL_HEIGHT_MM = 40;

export const LABEL_SETTINGS_STORAGE_KEY = 'admin_avatar_label_settings';

export interface AvatarLabelSettings {
  widthMm: number;
  heightMm: number;
  weddingDate: string;
  /** Data URL si fond personnalisé, sinon null → fond par défaut */
  backgroundDataUrl: string | null;
}

export function defaultAvatarLabelSettings(): AvatarLabelSettings {
  return {
    widthMm: DEFAULT_LABEL_WIDTH_MM,
    heightMm: DEFAULT_LABEL_HEIGHT_MM,
    weddingDate: DEFAULT_WEDDING_DATE,
    backgroundDataUrl: null,
  };
}

export function loadAvatarLabelSettings(): AvatarLabelSettings {
  const defaults = defaultAvatarLabelSettings();
  try {
    const raw = localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AvatarLabelSettings>;
    return {
      widthMm: clampMm(parsed.widthMm, defaults.widthMm),
      heightMm: clampMm(parsed.heightMm, defaults.heightMm),
      weddingDate: typeof parsed.weddingDate === 'string' && parsed.weddingDate.trim()
        ? parsed.weddingDate.trim()
        : defaults.weddingDate,
      backgroundDataUrl:
        typeof parsed.backgroundDataUrl === 'string' && parsed.backgroundDataUrl.startsWith('data:')
          ? parsed.backgroundDataUrl
          : null,
    };
  } catch {
    return defaults;
  }
}

export function saveAvatarLabelSettings(settings: AvatarLabelSettings): void {
  try {
    localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // quota exceeded etc.
  }
}

function clampMm(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(20, Math.round(n * 10) / 10));
}

export interface AvatarLabelPerson {
  prenom: string;
  nom: string;
  imageSrc: string;
}

export interface AvatarLabelFamille {
  displayName: string;
  personnes: AvatarLabelPerson[];
}
