import Phaser from "phaser";
import { getAvatar } from "./avatarService.js";

interface NPC {
  action?: () => void;
  objectiveId?: number;
}

interface InputService {
  events: Phaser.Events.EventEmitter;
}

interface ChecklistService {
  markDone: (objectiveId: number) => void;
}

class UIService {
  private scene: Phaser.Scene;
  private user: any;
  private checklistService: ChecklistService | null;
  private inputService: InputService;
  private uiVisible: boolean = true;

  private actionButton: Phaser.GameObjects.Image | null = null;
  private toggleBtn: Phaser.GameObjects.Image | null = null;
  private avatarContainer: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    user: any,
    checklistService: ChecklistService | null,
    inputService: InputService
  ) {
    this.scene = scene;
    this.user = user;
    this.checklistService = checklistService;
    this.inputService = inputService;

    this.createActionButton();
    this.createToggleButton();
    this.loadAvatar();

    this.inputService.events.on("action", () => this.handleAction());
  }

  private createActionButton(): void {
    const margin = 10;
    const btnSize = 48;
    const x = this.scene.scale.width - margin - btnSize;
    const y = this.scene.scale.height - margin - btnSize * 1.5;

    this.actionButton = this.scene.add.image(x, y, "ui-interface", "button_action")
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(150)
      .setAlpha(0.4);

    (this.actionButton as any).active = false;
  }

  public showActionButton(active: boolean, npc: NPC | null = null): void {
    if (!this.actionButton) return;
    (this.actionButton as any).npc = npc;

    if (active) {
      this.actionButton.setAlpha(1);
      (this.actionButton as any).active = true;
    } else {
      this.actionButton.setAlpha(0.4);
      (this.actionButton as any).active = false;
      (this.actionButton as any).npc = null;
    }
  }

  private handleAction(): void {
    if (!this.actionButton || !(this.actionButton as any).active) return;

    const npc: NPC | null = (this.actionButton as any).npc;
    if (!npc) return;

    if (npc.action) npc.action();
    if (npc.objectiveId && this.checklistService) {
      this.checklistService.markDone(npc.objectiveId);
    }

    this.showActionButton(false);
  }

  private createToggleButton(): void {
    const margin = 10;

    this.toggleBtn = this.scene.add.image(
      this.scene.scale.width - margin - 24,
      margin + 24,
      "ui-toggle"
    )
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(150)
    .on("pointerdown", () => {
      this.uiVisible = !this.uiVisible;
      this.toggleUI(this.uiVisible);
    });
  }

  public toggleUI(visible: boolean): void {
    if (this.actionButton) this.actionButton.setVisible(visible);
    if (this.toggleBtn) this.toggleBtn.setVisible(visible);
    if (this.avatarContainer) this.avatarContainer.setVisible(visible);
  }

  private async loadAvatar(): Promise<void> {
    const personne_id =
      this.scene.registry.get("personne_id") || parseInt(localStorage.getItem("personne_id") || "", 10);

    if (!personne_id) return;

    const avatarContainer = this.scene.add.container(400, 300);
    const avatarSprite = this.scene.add.sprite(0, 0, "player", 0);
    avatarContainer.add(avatarSprite);

    const { data } = await getAvatar(personne_id);
    if (data) {
      if (data.couleur_peau === 2) avatarSprite.setTint(0xfad7b6);
      else if (data.couleur_peau === 3) avatarSprite.setTint(0x8d5524);
      else avatarSprite.clearTint();

      if (data.chapeau) {
        const chapeau = this.scene.add.sprite(0, -20, "chapeau_" + data.chapeau);
        avatarContainer.add(chapeau);
      }
    }

    this.avatarContainer = avatarContainer;
  }
}

export default UIService;
