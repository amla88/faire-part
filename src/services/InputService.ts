import Phaser from "phaser";

type MoveDirection = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

type TouchButton = {
  normal: Phaser.GameObjects.Image;
  pressed: Phaser.GameObjects.Image;
  disabled: Phaser.GameObjects.Image;
  showPressed: () => void;
  hidePressed: () => void;
  setEnabled: (v: boolean) => void;
};

class InputService {
  scene: Phaser.Scene;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  spaceKey: Phaser.Input.Keyboard.Key;
  moveDirection: MoveDirection;
  touchButtons: Record<string, TouchButton>;
  uiVisible: boolean;
  events: Phaser.Events.EventEmitter;
  private actionBtn?: Phaser.GameObjects.Image;
  private readonly uiScale = 2; // UI à x2
  private uiInitialized = false;

  private destroyTouchButtons() {
    // Détruit tous les éléments d'UI existants pour éviter les doublons/"fantômes"
    Object.values(this.touchButtons).forEach((tb) => {
      tb?.normal?.destroy();
      tb?.pressed?.destroy();
      tb?.disabled?.destroy();
    });
    this.touchButtons = {};
    this.actionBtn?.destroy();
    this.actionBtn = undefined;
    this.uiInitialized = false;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (!this.scene.input.keyboard) {
      // Initialize an empty cursor-like object to avoid null refs on serverless builds
      // @ts-expect-error: partial assignment for safety
      this.cursors = {};
    } else {
      this.cursors = this.scene.input.keyboard.createCursorKeys();
    }
    this.spaceKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.moveDirection = { up: false, down: false, left: false, right: false };
    this.touchButtons = {};
    this.uiVisible = true;

    this.events = new Phaser.Events.EventEmitter();
  }

  // UI à échelle fixe x2 (pas de scale dynamique)

  private isCoarsePointer(): boolean {
    try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
  }

  private getButtonFrameSize(): { w: number; h: number } {
    const tex = this.scene.textures.get("ui-interface");
    const f = tex.get("arrow_up");
    return { w: f ? f.width : 32, h: f ? f.height : 32 };
  }

  createTouchButtons() {
  // Nettoie d'abord si déjà créé
  if (this.uiInitialized) this.destroyTouchButtons();
    const uiInterface = "ui-interface";
    const { w: baseW, h: baseH } = this.getButtonFrameSize();
  const uiScale = this.uiScale;
  const btnW = baseW * uiScale;
  const btnH = baseH * uiScale;
    const baseMargin = this.isCoarsePointer() ? 10 : 6;
  const margin = baseMargin * uiScale;
    const centerX = Math.round(margin + btnW * 1.5);
    const centerY = Math.round(this.scene.scale.height - margin - btnH * 1.5);

    const createButton = (
      key: string,
      keyPressed: string,
      keyDisabled: string,
      x: number,
      y: number,
      dir: keyof MoveDirection
    ) => {
      const normal = this.scene.add.image(Math.round(x), Math.round(y), uiInterface, key)
        .setInteractive().setScrollFactor(0).setDepth(100).setScale(uiScale);
      const pressed = this.scene.add.image(Math.round(x), Math.round(y), uiInterface, keyPressed)
        .setScrollFactor(0).setDepth(101).setAlpha(0).setScale(uiScale);
      const disabled = this.scene.add.image(Math.round(x), Math.round(y), uiInterface, keyDisabled)
        .setScrollFactor(0).setDepth(102).setAlpha(0).setScale(uiScale);

      const showPressed = () => {
        this.moveDirection[dir] = true;
        pressed.setAlpha(1);
        normal.setAlpha(0);
      };
      const hidePressed = () => {
        this.moveDirection[dir] = false;
        pressed.setAlpha(0);
        normal.setAlpha(1);
      };

  normal.on("pointerdown", showPressed);
  normal.on("pointerup", hidePressed);
  normal.on("pointerout", hidePressed);

  this.touchButtons[dir] = { normal, pressed, disabled, showPressed, hidePressed, setEnabled: (v: boolean) => {} };
    };

  createButton("arrow_up", "arrow_up_pressed", "arrow_up_disabled", centerX, centerY - btnH, "up");
  createButton("arrow_down", "arrow_down_pressed", "arrow_down_disabled", centerX, centerY + btnH, "down");
  createButton("arrow_left", "arrow_left_pressed", "arrow_left_disabled", centerX - btnW, centerY, "left");
  createButton("arrow_right", "arrow_right_pressed", "arrow_right_disabled", centerX + btnW, centerY, "right");

  // clavier : espace déclenche action
    this.spaceKey.on("down", () => this.events.emit("action"));

    // synchronisation avec clavier
  this.cursors.up && this.cursors.up.on("down", () => this.touchButtons["up"].showPressed());
  this.cursors.up && this.cursors.up.on("up", () => this.touchButtons["up"].hidePressed());
  this.cursors.down && this.cursors.down.on("down", () => this.touchButtons["down"].showPressed());
  this.cursors.down && this.cursors.down.on("up", () => this.touchButtons["down"].hidePressed());
  this.cursors.left && this.cursors.left.on("down", () => this.touchButtons["left"].showPressed());
  this.cursors.left && this.cursors.left.on("up", () => this.touchButtons["left"].hidePressed());
  this.cursors.right && this.cursors.right.on("down", () => this.touchButtons["right"].showPressed());
  this.cursors.right && this.cursors.right.on("up", () => this.touchButtons["right"].hidePressed());
    // Ajuster sur resize
  this.scene.scale.on("resize", () => this.updateTouchButtonsLayout());
  // Premier layout correct après fit
  this.scene.time.delayedCall(0, () => this.updateTouchButtonsLayout());
  this.uiInitialized = true;
  }

  private updateTouchButtonsLayout() {
    const { w: baseW, h: baseH } = this.getButtonFrameSize();
  const uiScale = this.uiScale;
  const btnW = baseW * uiScale;
  const btnH = baseH * uiScale;
    const baseMargin = this.isCoarsePointer() ? 10 : 6;
  const margin = baseMargin * uiScale;
    const centerX = Math.round(margin + btnW * 1.5);
    const centerY = Math.round(this.scene.scale.height - margin - btnH * 1.5);

    const tb = this.touchButtons;
    const setBtn = (key: keyof MoveDirection, x: number, y: number) => {
      if (!tb[key]) return;
  tb[key].normal.setPosition(Math.round(x), Math.round(y)).setScale(uiScale);
  tb[key].pressed.setPosition(Math.round(x), Math.round(y)).setScale(uiScale);
  tb[key].disabled.setPosition(Math.round(x), Math.round(y)).setScale(uiScale);
    };

    setBtn("up", centerX, centerY - btnH);
    setBtn("down", centerX, centerY + btnH);
    setBtn("left", centerX - btnW, centerY);
    setBtn("right", centerX + btnW, centerY);

  // L'action button est géré par UIService désormais
  }

  getMovement(): MoveDirection {
    return {
  up: !!(this.cursors.up && (this.cursors.up as any).isDown) || this.moveDirection.up,
  down: !!(this.cursors.down && (this.cursors.down as any).isDown) || this.moveDirection.down,
  left: !!(this.cursors.left && (this.cursors.left as any).isDown) || this.moveDirection.left,
  right: !!(this.cursors.right && (this.cursors.right as any).isDown) || this.moveDirection.right,
    };
  }
}

export default InputService;
