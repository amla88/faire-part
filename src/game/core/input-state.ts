export interface VirtualInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
}

export const virtualInputState: VirtualInputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  interact: false,
};

export function resetVirtualInputState(): void {
  virtualInputState.up = false;
  virtualInputState.down = false;
  virtualInputState.left = false;
  virtualInputState.right = false;
  virtualInputState.interact = false;
}

