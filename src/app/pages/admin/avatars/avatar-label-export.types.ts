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
  /** true = une étiquette par membre ; false = une étiquette globale par famille */
  oneLabelPerPerson: boolean;
}

export function defaultAvatarLabelSettings(): AvatarLabelSettings {
  return {
    widthMm: DEFAULT_LABEL_WIDTH_MM,
    heightMm: DEFAULT_LABEL_HEIGHT_MM,
    weddingDate: DEFAULT_WEDDING_DATE,
    backgroundDataUrl: null,
    oneLabelPerPerson: false,
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
      oneLabelPerPerson: parsed.oneLabelPerPerson === true,
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
  /** Sous-titre (ex. nom de famille) sur les étiquettes individuelles */
  subtitle?: string;
  personnes: AvatarLabelPerson[];
}

export function expandLabelJobs(
  familles: AvatarLabelFamille[],
  settings: AvatarLabelSettings,
  placeholderSrc: string
): AvatarLabelFamille[] {
  if (!settings.oneLabelPerPerson) {
    return familles;
  }

  const jobs: AvatarLabelFamille[] = [];
  for (const famille of familles) {
    const members =
      famille.personnes.length > 0
        ? famille.personnes
        : [{ prenom: '?', nom: '', imageSrc: placeholderSrc }];
    for (const personne of members) {
      const personName = `${personne.prenom} ${personne.nom}`.trim();
      jobs.push({
        displayName: personName || famille.displayName,
        subtitle: famille.displayName,
        personnes: [personne],
      });
    }
  }
  return jobs;
}
