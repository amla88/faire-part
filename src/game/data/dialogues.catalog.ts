import { DialogueData } from '../ui/DialogueBox';

export type DialogueId = 'act0.intro' | 'act1.register';

export const dialoguesCatalog: Record<DialogueId, DialogueData> = {
  'act0.intro': {
    steps: [
      {
        speaker: 'Le Cocher',
        portraitColor: 0xc9a55c,
        text:
          "La route est encore longue jusqu'à la ferme. Ajustez votre tenue, cher invité, car le monde entier aura les yeux rivés sur vous à notre arrivée.",
      },
    ],
  },
  'act1.register': {
    steps: [
      {
        speaker: 'Monsieur de La Plume',
        portraitColor: 0xc9a55c,
        text:
          "Votre nom, s'il vous plaît ? Le protocole du banquet est une science exacte. Je dois savoir si vous honorerez notre table pour le souper ou si vous nous rejoindrez pour les festivités nocturnes.",
      },
    ],
  },
};

export function getDialogue(id: DialogueId): DialogueData {
  return dialoguesCatalog[id];
}

