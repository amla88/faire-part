export type PresenceMoment = 'soiree' | 'repas' | 'reception' | 'anniversaire';

export const ALL_PRESENCE_MOMENTS: PresenceMoment[] = ['reception', 'repas', 'soiree', 'anniversaire'];

const MOMENT_LABELS: Record<PresenceMoment, string> = {
  reception: 'Réception',
  repas: 'Repas',
  soiree: 'Soirée',
  anniversaire: 'Anniversaire',
};

function inviteKey(moment: PresenceMoment): string {
  if (moment === 'soiree') return 'invite_soiree';
  if (moment === 'repas') return 'invite_repas';
  if (moment === 'anniversaire') return 'invite_anniversaire';
  return 'invite_reception';
}

function presentKey(moment: PresenceMoment): string {
  if (moment === 'soiree') return 'present_soiree';
  if (moment === 'repas') return 'present_repas';
  if (moment === 'anniversaire') return 'present_anniversaire';
  return 'present_reception';
}

export function presenceMomentLabel(moment: PresenceMoment): string {
  return MOMENT_LABELS[moment];
}

export function presenceLabel(person: any, moment: PresenceMoment): string {
  if (person?.decline_invitation) return 'Refus invitation';
  const ik = inviteKey(moment);
  const pk = presentKey(moment);
  if (!person?.[ik]) return 'Non invité';
  return person?.[pk] ? 'Oui' : 'Non';
}

export function presenceClass(person: any, moment: PresenceMoment): string {
  if (person?.decline_invitation) return 'presence--declined';
  const ik = inviteKey(moment);
  const pk = presentKey(moment);
  if (!person?.[ik]) return 'presence--na';
  return person?.[pk] ? 'presence--yes' : 'presence--no';
}
