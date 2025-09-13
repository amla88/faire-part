import Phaser from "phaser";
// Fix import path (same folder, no .js extension in TS/ESM)
import { getAvatar } from "./avatarService";

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
  
  private vibrate(ms: number) {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
        (navigator as any).vibrate(ms);
      }
    } catch {}
  }
  
  private pulseActionButton(scaleBase: number) {
    if (!this.actionButton) return;
    const down = scaleBase * 0.9; // 2.0 -> 1.8
    this.scene.tweens.killTweensOf(this.actionButton);
    this.scene.tweens.add({
      targets: this.actionButton,
      scaleX: down,
      scaleY: down,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

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
    const uiScale = 2; // align with InputService
    const atlas = this.scene.textures.get("ui-interface");
    const frame = atlas.get("button_action");
    const baseW = frame ? (frame as any).width : 48;
    const baseH = frame ? (frame as any).height : 48;
    const btnW = baseW * uiScale;
    const btnH = baseH * uiScale;
    const x = this.scene.scale.width - margin - btnW / 2;
    const y = this.scene.scale.height - margin - btnH * 1.5;

    this.actionButton = this.scene.add.image(x, y, "ui-interface", "button_action")
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(150)
      .setAlpha(0.4)
      .setScale(uiScale)
      .on("pointerdown", () => {
        this.pulseActionButton(uiScale);
        this.vibrate(15);
        this.inputService.events.emit("action");
      });

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
    const x = this.scene.scale.width - margin - 24;
    const y = margin + 24;

    // Prefer using a frame from the 'ui-interface' atlas if available; otherwise fall back to action button.
    const textures = this.scene.textures;
    const hasUIAtlas = textures.exists("ui-interface");
    const atlas = hasUIAtlas ? textures.get("ui-interface") : null;
    const hasToggleFrame = !!atlas && (atlas as any).has && (atlas as any).has("toggle");
    const chosenKey = "ui-interface";
    const chosenFrame = hasToggleFrame ? "toggle" : "button_action";

    if (!hasUIAtlas) {
      console.warn("UIService: 'ui-interface' atlas not loaded; skipping toggle button to avoid runtime error.");
      return;
    }

    this.toggleBtn = this.scene.add
      .image(x, y, chosenKey, chosenFrame)
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

    // Crée un conteneur d'avatar en overlay UI (pas dans le monde du jeu) et caché par défaut
    const margin = 10;
    const avatarContainer = this.scene.add.container(margin, margin)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);
    // Utilise l'atlas Aseprite par défaut si disponible
    const hasThib = this.scene.textures.exists('thib_idle_front');
    const avatarSprite = hasThib
      ? this.scene.add.sprite(0, 0, 'thib_idle_front', 'Idle_front_0')
      : this.scene.add.sprite(0, 0, 'npcSprite', 0);
    avatarContainer.add(avatarSprite);

  const { data } = await getAvatar(String(personne_id));
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
