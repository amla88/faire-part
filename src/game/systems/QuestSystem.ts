import { gameState } from '../core/game-state';

export const QuestFlags = {
  act0Chosen: 'act0.chosen',
  act0IntroSeen: 'act0.intro_seen',
  act1RegisterDone: 'act1.register_done',
  act2AllergensDone: 'act2.allergens_done',
  act3AvatarDone: 'act3.avatar_done',
  act4PhotoDone: 'act4.photo_done',
  act4AnecdoteDone: 'act4.anecdote_done',
  act5IdeaDone: 'act5.idea_done',
  act6MusicDone: 'act6.music_done',
  hubMapUnlocked: 'hub.map_unlocked',
  finalSeen: 'final.seen',
} as const;

export type QuestFlagKey = (typeof QuestFlags)[keyof typeof QuestFlags];

export class QuestSystem {
  isDone(flag: QuestFlagKey): boolean {
    return gameState.getFlag(flag);
  }

  done(flag: QuestFlagKey): void {
    gameState.setFlag(flag, true);
  }
}

export const quests = new QuestSystem();

