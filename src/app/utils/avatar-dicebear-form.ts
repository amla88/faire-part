/**
 * État formulaire + payloads DiceBear — alignés sur AvatarEditorComponent (site).
 */

import {
  AVATAR_ACCESSORIES_COLOR_OPTIONS,
  AVATAR_ACCESSORIES_OPTIONS,
  AVATAR_BACKGROUND_COLOR_OPTIONS,
  AVATAR_CLOTHING_GRAPHIC_OPTIONS,
  AVATAR_CLOTHING_OPTIONS,
  AVATAR_CLOTHES_COLOR_OPTIONS,
  AVATAR_EYEBROWS_OPTIONS,
  AVATAR_EYES_OPTIONS,
  AVATAR_FACIAL_HAIR_OPTIONS,
  AVATAR_HAIR_COLOR_OPTIONS,
  AVATAR_MOUTH_OPTIONS,
  AVATAR_SKIN_COLOR_OPTIONS,
  AVATAR_TOP_OPTIONS,
} from './avatar-dicebear-catalog';

export const AVATAR_FORM_NONE = 'none';

export interface AvatarDicebearFormState {
  seed: string;
  top: string;
  accessories: string;
  accessoriesColor: string;
  hairColor: string;
  facialHair: string;
  clothing: string;
  clothingGraphic: string;
  clothesColor: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  skinColor: string;
  backgroundColor: string;
}

export function cloneAvatarDicebearFormState(f: AvatarDicebearFormState): AvatarDicebearFormState {
  return { ...f };
}

export function defaultAvatarDicebearFormState(): AvatarDicebearFormState {
  return {
    seed: 'default-seed',
    top: 'longButNotTooLong',
    accessories: 'kurt',
    accessoriesColor: '262e33',
    hairColor: 'a55728',
    facialHair: 'beardMedium',
    clothing: 'blazerAndShirt',
    clothingGraphic: 'bat',
    clothesColor: '3c4f5c',
    eyes: 'default',
    eyebrows: 'default',
    mouth: 'default',
    skinColor: 'edb98a',
    backgroundColor: 'b6e3f4',
  };
}

function firstArrayOrString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === 'string') return v;
  return '';
}

/** Reprend les options persistées (RPC / JSON) comme sur le site. */
export function formStateFromRpcOptions(raw: unknown, seedFromRow?: string | null): AvatarDicebearFormState {
  const d = defaultAvatarDicebearFormState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (seedFromRow != null && String(seedFromRow).trim() !== '') d.seed = String(seedFromRow);
    return d;
  }
  const o = raw as Record<string, unknown>;
  const s = o['seed'];
  if (typeof s === 'string' && s.trim() !== '') d.seed = s;
  else if (seedFromRow != null && String(seedFromRow).trim() !== '') d.seed = String(seedFromRow);

  d.top = firstArrayOrString(o, 'top') || d.top;
  d.hairColor = firstArrayOrString(o, 'hairColor') || d.hairColor;
  d.accessoriesColor = firstArrayOrString(o, 'accessoriesColor') || d.accessoriesColor;
  d.clothesColor = firstArrayOrString(o, 'clothesColor') || d.clothesColor;
  d.eyes = firstArrayOrString(o, 'eyes') || d.eyes;
  d.eyebrows = firstArrayOrString(o, 'eyebrows') || d.eyebrows;
  d.mouth = firstArrayOrString(o, 'mouth') || d.mouth;
  d.skinColor = firstArrayOrString(o, 'skinColor') || d.skinColor;
  d.backgroundColor = firstArrayOrString(o, 'backgroundColor') || d.backgroundColor;
  d.clothing = firstArrayOrString(o, 'clothing') || d.clothing;

  d.accessories =
    o['accessoriesProbability'] === 0 ? AVATAR_FORM_NONE : firstArrayOrString(o, 'accessories') || d.accessories;
  d.facialHair =
    o['facialHairProbability'] === 0 ? AVATAR_FORM_NONE : firstArrayOrString(o, 'facialHair') || d.facialHair;
  d.clothingGraphic =
    o['clothingGraphicProbability'] === 0
      ? AVATAR_FORM_NONE
      : firstArrayOrString(o, 'clothingGraphic') || d.clothingGraphic;

  return d;
}

export function dicebearValueOrFallback(ui: string, fallback: string): string {
  return ui === AVATAR_FORM_NONE ? fallback : ui;
}

export function dicebearProbability(ui: string): number {
  return ui === AVATAR_FORM_NONE ? 0 : 100;
}

/** Options passées à createAvatar (aperçu / PNG). */
export function buildDicebearCreateOptions(form: AvatarDicebearFormState, size: number): Record<string, unknown> {
  return {
    seed: form.seed,
    size,
    top: [form.top],
    accessories: [dicebearValueOrFallback(form.accessories, 'kurt')],
    accessoriesProbability: dicebearProbability(form.accessories),
    accessoriesColor: [form.accessoriesColor],
    hairColor: [form.hairColor],
    hatColor: [form.hairColor],
    facialHair: [dicebearValueOrFallback(form.facialHair, 'beardMedium')],
    facialHairColor: [form.hairColor],
    facialHairProbability: dicebearProbability(form.facialHair),
    clothing: [form.clothing],
    clothingGraphic: [dicebearValueOrFallback(form.clothingGraphic, 'bat')],
    clothingGraphicProbability: dicebearProbability(form.clothingGraphic),
    clothesColor: [form.clothesColor],
    eyes: [form.eyes],
    eyebrows: [form.eyebrows],
    mouth: [form.mouth],
    skinColor: [form.skinColor],
    backgroundColor: [form.backgroundColor],
  };
}

/** Objet `p_options` + champ seed aligné sur saveAvatar() Angular. */
export function buildAvatarUpsertOptionsJson(form: AvatarDicebearFormState): Record<string, unknown> {
  return {
    seed: form.seed,
    top: [form.top],
    accessories: [dicebearValueOrFallback(form.accessories, 'kurt')],
    accessoriesProbability: dicebearProbability(form.accessories),
    accessoriesColor: [form.accessoriesColor],
    hairColor: [form.hairColor],
    hatColor: [form.hairColor],
    facialHair: [dicebearValueOrFallback(form.facialHair, 'beardMedium')],
    facialHairColor: [form.hairColor],
    facialHairProbability: dicebearProbability(form.facialHair),
    clothing: [form.clothing],
    clothingGraphic: [dicebearValueOrFallback(form.clothingGraphic, 'bat')],
    clothingGraphicProbability: dicebearProbability(form.clothingGraphic),
    clothesColor: [form.clothesColor],
    eyes: [form.eyes],
    eyebrows: [form.eyebrows],
    mouth: [form.mouth],
    skinColor: [form.skinColor],
    backgroundColor: [form.backgroundColor],
  };
}

function pickValue(opts: readonly { value: string }[]): string {
  return opts[Math.floor(Math.random() * opts.length)]!.value;
}

/** Même logique que `generateRandomSeed()` dans AvatarEditorComponent. */
export function randomizeAvatarDicebearForm(form: AvatarDicebearFormState): void {
  form.seed = Math.random().toString(36).substring(2, 15);
  form.top = pickValue(AVATAR_TOP_OPTIONS);
  form.accessories = pickValue(AVATAR_ACCESSORIES_OPTIONS);
  form.hairColor = pickValue(AVATAR_HAIR_COLOR_OPTIONS);
  form.facialHair = pickValue(AVATAR_FACIAL_HAIR_OPTIONS);
  form.clothing = pickValue(AVATAR_CLOTHING_OPTIONS);
  form.clothingGraphic = pickValue(AVATAR_CLOTHING_GRAPHIC_OPTIONS);
  form.clothesColor = pickValue(AVATAR_CLOTHES_COLOR_OPTIONS);
  form.accessoriesColor = pickValue(AVATAR_ACCESSORIES_COLOR_OPTIONS);
  form.eyes = pickValue(AVATAR_EYES_OPTIONS);
  form.eyebrows = pickValue(AVATAR_EYEBROWS_OPTIONS);
  form.mouth = pickValue(AVATAR_MOUTH_OPTIONS);
  form.skinColor = pickValue(AVATAR_SKIN_COLOR_OPTIONS);
  form.backgroundColor = pickValue(AVATAR_BACKGROUND_COLOR_OPTIONS);
}
