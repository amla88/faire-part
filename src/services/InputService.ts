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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.spaceKey = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.moveDirection = { up: false, down: false, left: false, right: false };
    this.touchButtons = {};
    this.uiVisible = true;

    this.events = new Phaser.Events.EventEmitter();
  }

  createTouchButtons() {
    const btnSize = 48;
    const margin = 10;
    const centerX = margin + btnSize * 1.5;
    const centerY = this.scene.scale.height - margin - btnSize * 1.5;
    const uiInterface = "ui-interface";

    const createButton = (
      key: string,
      keyPressed: string,
      keyDisabled: string,
      x: number,
      y: number,
      dir: keyof MoveDirection
    ) => {
      const normal = this.scene.add.image(x, y, uiInterface, key)
        .setInteractive().setScrollFactor(0).setDepth(100).setDisplaySize(btnSize, btnSize);
      const pressed = this.scene.add.image(x, y, uiInterface, keyPressed)
        .setInteractive().setScrollFactor(0).setDepth(101).setAlpha(0).setDisplaySize(btnSize, btnSize);
      const disabled = this.scene.add.image(x, y, uiInterface, keyDisabled)
        .setInteractive().setScrollFactor(0).setDepth(102).setAlpha(0).setDisplaySize(btnSize, btnSize);

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
      pressed.on("pointerup", hidePressed);
      pressed.on("pointerout", hidePressed);

      this.touchButtons[dir] = { normal, pressed, disabled, showPressed, hidePressed, setEnabled: (v: boolean) => {} };
    };

    createButton("arrow_up", "arrow_up_pressed", "arrow_up_disabled", centerX, centerY - btnSize, "up");
    createButton("arrow_down", "arrow_down_pressed", "arrow_down_disabled", centerX, centerY + btnSize, "down");
    createButton("arrow_left", "arrow_left_pressed", "arrow_left_disabled", centerX - btnSize, centerY, "left");
    createButton("arrow_right", "arrow_right_pressed", "arrow_right_disabled", centerX + btnSize, centerY, "right");

    // bouton d'action tactile
    const actionBtn = this.scene.add.image(centerX + 150, centerY, uiInterface, "button_action")
      .setInteractive().setScrollFactor(0).setDepth(101).setAlpha(0.4);
    actionBtn.on("pointerdown", () => this.events.emit("action"));

    // clavier : espace déclenche action
    this.spaceKey.on("down", () => this.events.emit("action"));

    // synchronisation avec clavier
    this.cursors.up.on("down", () => this.touchButtons["up"].showPressed());
    this.cursors.up.on("up", () => this.touchButtons["up"].hidePressed());
    this.cursors.down.on("down", () => this.touchButtons["down"].showPressed());
    this.cursors.down.on("up", () => this.touchButtons["down"].hidePressed());
    this.cursors.left.on("down", () => this.touchButtons["left"].showPressed());
    this.cursors.left.on("up", () => this.touchButtons["left"].hidePressed());
    this.cursors.right.on("down", () => this.touchButtons["right"].showPressed());
    this.cursors.right.on("up", () => this.touchButtons["right"].hidePressed());
  }

  getMovement(): MoveDirection {
    return {
      up: this.cursors.up?.isDown || this.moveDirection.up,
      down: this.cursors.down?.isDown || this.moveDirection.down,
      left: this.cursors.left?.isDown || this.moveDirection.left,
      right: this.cursors.right?.isDown || this.moveDirection.right,
    };
  }
}

export default InputService;
