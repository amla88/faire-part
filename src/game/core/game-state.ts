export type PlayerArchetype = 'Lady' | 'Gentleman' | 'Reine de la nuit' | 'Duc de la scene';

export type ActId = 'act0' | 'act1' | 'act2' | 'act3';

export interface GameStateSnapshot {
  act: ActId;
  player?: PlayerArchetype;
  flags: Record<string, boolean>;
}

const STORAGE_KEY = 'faire-part-game-state';

export class GameState {
  private state: GameStateSnapshot = {
    act: 'act0',
    flags: {},
  };

  get snapshot(): GameStateSnapshot {
    return this.state;
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<GameStateSnapshot> | null;
      if (!parsed || typeof parsed !== 'object') return false;
      const act = parsed.act;
      if (act !== 'act0' && act !== 'act1' && act !== 'act2' && act !== 'act3') return false;
      const flags = parsed.flags && typeof parsed.flags === 'object' ? (parsed.flags as Record<string, boolean>) : {};
      const player = parsed.player;
      this.state = { act, flags, player: player as any };
      return true;
    } catch {
      return false;
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  reset(): void {
    this.state = { act: 'act0', flags: {} };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  setAct(act: ActId): void {
    this.state.act = act;
    this.save();
  }

  setPlayer(player: PlayerArchetype): void {
    this.state.player = player;
    this.save();
  }

  setFlag(key: string, value: boolean): void {
    this.state.flags[key] = value;
    this.save();
  }

  getFlag(key: string): boolean {
    return this.state.flags[key] === true;
  }
}

export const gameState = new GameState();

