export type PlayerArchetype = 'Lady' | 'Gentleman' | 'Reine de la nuit' | 'Duc de la scene';

export type ActId = 'act0' | 'act1' | 'act2' | 'act3';

export interface GameStateSnapshot {
  act: ActId;
  player?: PlayerArchetype;
  flags: Record<string, boolean>;
}

export class GameState {
  private state: GameStateSnapshot = {
    act: 'act0',
    flags: {},
  };

  get snapshot(): GameStateSnapshot {
    return this.state;
  }

  setAct(act: ActId): void {
    this.state.act = act;
  }

  setPlayer(player: PlayerArchetype): void {
    this.state.player = player;
  }

  setFlag(key: string, value: boolean): void {
    this.state.flags[key] = value;
  }

  getFlag(key: string): boolean {
    return this.state.flags[key] === true;
  }
}

export const gameState = new GameState();

