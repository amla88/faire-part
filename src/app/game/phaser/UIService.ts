import Phaser from 'phaser';

interface NPC { action?: () => void; objectiveId?: number }
interface ChecklistService { markDone: (objectiveId: number) => void }
interface InputService { events: Phaser.Events.EventEmitter }

export default class UIService {
  private scene: Phaser.Scene;
  private checklistService: ChecklistService | null;
  private inputService: InputService;
  private actionButton: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, user: any, checklistService: ChecklistService | null, inputService: InputService) {
    this.scene = scene;
    this.checklistService = checklistService;
    this.inputService = inputService;
    this.createActionButton();
    this.inputService.events.on('action', () => this.handleAction());
  }

  private createActionButton() {
    const margin = 10; const uiScale = 2;
    if (!this.scene.textures.exists('ui-interface')) return;
    this.actionButton = this.scene.add.image(this.scene.scale.width - margin - 48, this.scene.scale.height - margin - 48*1.5, 'ui-interface', 'button_action')
      .setInteractive().setScrollFactor(0).setDepth(150).setAlpha(0.4).setScale(uiScale)
      .on('pointerdown', () => { this.inputService.events.emit('action'); });
    (this.actionButton as any).active = false;
  }

  showActionButton(active: boolean, npc: NPC | null = null) {
    if (!this.actionButton) return;
    (this.actionButton as any).npc = npc;
    if (active) { this.actionButton.setAlpha(1); (this.actionButton as any).active = true; }
    else { this.actionButton.setAlpha(0.4); (this.actionButton as any).active = false; (this.actionButton as any).npc = null; }
  }

  private handleAction() {
    if (!this.actionButton || !(this.actionButton as any).active) return;
    const npc: NPC | null = (this.actionButton as any).npc;
    if (!npc) return;
    if (npc.action) npc.action();
    if (npc.objectiveId && this.checklistService) this.checklistService.markDone(npc.objectiveId);
    this.showActionButton(false);
  }
}
