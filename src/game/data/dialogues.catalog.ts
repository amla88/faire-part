import { DialogueData } from '../ui/DialogueBox';

export type DialogueId =
  | 'act0.intro'
  | 'act1.register'
  | 'act1.already'
  | 'act1.toChef'
  | 'act2.chefIntro'
  | 'act3.mapUnlock'
  | 'act4.vergerIntro'
  | 'act5.glorietteIntro'
  | 'act6.ecurieIntro';

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
        portraitTexture: 'portrait-majordome',
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
        portraitTexture: 'portrait-majordome',
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
        portraitTexture: 'portrait-majordome',
        portraitColor: 0xc9a55c,
        text:
          "Parfait. Un dernier détail — et non des moindres. L’Intendant des Cuisines a réclamé votre attention avec l’urgence d’un patch en production : il veut vous parler… près des fourneaux. Je vous déconseille de le faire patienter — il manie la louche comme d’autres manient la satire.",
      },
    ],
  },
  'act2.chefIntro': {
    steps: [
      {
        speaker: "L'Intendant des Cuisines",
        portraitColor: 0xabbca6,
        text:
          "Doucement, voyageur ! Ma cuisine est un temple de délices, mais je refuserais de vous empoisonner par mégarde. Y a-t-il des noix, du gluten ou d’autres maléfices que votre estomac ne saurait tolérer ? Confiez-moi vos interdits — et si vous préférez le ton technique : j’ai aussi des casseroles, des timings… et des invités. Un invité malheureux, c’est un bug critique.",
      },
    ],
  },
  'act3.mapUnlock': {
    steps: [
      {
        speaker: 'Madame Chromatique',
        portraitColor: 0xabbca6,
        text:
          "Splendide. Votre effigie est désormais gravée avec la précision d’un hexadécimal… et l’élégance d’un bal à la Cour.",
      },
      {
        speaker: 'Madame Chromatique',
        portraitColor: 0xabbca6,
        text:
          "Mais prenez garde, cher invité : le Domaine est vaste, capricieux, et semé de couloirs où l’on se perd plus vite que dans un changelog mal tenu.",
      },
      {
        speaker: 'Madame Chromatique',
        portraitColor: 0xabbca6,
        text:
          "Tenez. Une carte. Elle vous évitera de tourner en rond comme un curseur sans focus. Désormais, libre à vous d’errer : revenir au Registre, saluer l’Intendant des Cuisines… ou courir vers de nouvelles scènes.",
      },
    ],
  },
  'act4.vergerIntro': {
    steps: [
      {
        speaker: 'Le Vicomte des Murmures',
        portraitColor: 0xc9a55c,
        text:
          "Psst… Approchez. Dans ce verger, les secrets tombent plus vite que les pommes. Confiez-moi une anecdote : je la consignerai avec plus de soin qu’un mot de passe dans un gestionnaire.",
      },
    ],
  },
  'act5.glorietteIntro': {
    steps: [
      {
        speaker: "La Baronne de l'Inspiration",
        portraitColor: 0xc9a55c,
        text:
          "Ah… ce regard. Il a l’éclat d’une idée prête à compiler. Écrivez votre suggestion : je la livrerai aux hôtes comme un patch élégant, sans jamais froisser le protocole.",
      },
    ],
  },
  'act6.ecurieIntro': {
    steps: [
      {
        speaker: 'Le Maestro Polyphonique',
        portraitColor: 0xabbca6,
        text:
          "La piste de danse est un système vivant : il lui faut des entrées, des sorties… et le bon tempo. Donnez-moi une chanson — titre, auteur, lien — et je l’ajouterai à la partition.",
      },
    ],
  },
};

export function getDialogue(id: DialogueId): DialogueData {
  return dialoguesCatalog[id];
}

