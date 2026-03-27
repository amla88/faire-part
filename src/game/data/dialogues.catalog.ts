import { DialogueData } from '../ui/DialogueBox';

export type DialogueId =
  | 'act0.intro'
  | 'act1.register'
  | 'act1.already'
  | 'act1.toChef'
  | 'act2.chefIntro';

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
  'act1.already': {
    steps: [
      {
        speaker: 'Monsieur de La Plume',
        portraitColor: 0xc9a55c,
        text:
          "Ah ! Votre nom brille déjà dans nos colonnes comme une promesse de fête. Entrez, la cour trépigne de vous voir !",
      },
    ],
  },
  'act1.toChef': {
    steps: [
      {
        speaker: 'Monsieur de La Plume',
        portraitColor: 0xc9a55c,
        text:
          "Parfait. Un dernier détail — et non des moindres. Le Chef a réclamé votre attention avec l’urgence d’un patch en production : il veut vous parler… dans les cuisines. Je vous déconseille de le faire patienter, il manie la louche comme d’autres manient la satire.",
      },
    ],
  },
  'act2.chefIntro': {
    steps: [
      {
        speaker: 'Le Chef',
        portraitColor: 0xabbca6,
        text:
          "Ah, vous voilà ! J’ai des casseroles, des timings… et des invités. Or, un invité malheureux, c’est un bug critique. Dites-moi : y a-t-il des noix, du gluten, ou quelque sortilège alimentaire que je dois bannir de mon code… euh, de ma cuisine ?",
      },
    ],
  },
};

export function getDialogue(id: DialogueId): DialogueData {
  return dialoguesCatalog[id];
}

