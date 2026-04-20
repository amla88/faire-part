import Phaser from 'phaser';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { resetVirtualInputState } from '../core/input-state';

export type ToggleOption = { key: string; label: string; value: boolean };

/** Au-dessus des textes UI de scène (souvent ~100000) pour éviter qu’ils recouvrent le formulaire. */
const FORM_UI_DEPTH = 100_520;

export class FormBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  /** Lignes / décor du mode bascules (rectangles, textes, etc.). */
  private toggleLayer: Phaser.GameObjects.GameObject[] = [];
  private hintText: Phaser.GameObjects.Text;
  private submitBg: Phaser.GameObjects.Graphics | null = null;
  private submitHit: Phaser.GameObjects.Rectangle | null = null;
  private submitLabel: Phaser.GameObjects.Text | null = null;

  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;
  private prevGlobalCaptureDisabled: boolean | null = null;

  public active = false;
  private cursor = 0;
  private toggles: ToggleOption[] = [];
  private onSubmitToggles?: (values: Record<string, boolean>) => void;
  private hintEnabled = true;
  private centerX: number;
  private centerY: number;
  private boxW: number;
  private boxH: number;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.boxW = Math.floor(width * 0.78);
    this.boxH = Math.floor(height * 0.34);
    this.centerX = Math.floor(width / 2);
    this.centerY = Math.floor(height / 2);

    const g = createCardGraphics(scene, this.centerX, this.centerY, this.boxW, this.boxH);
    this.shadow = g.shadow.setDepth(FORM_UI_DEPTH) as Phaser.GameObjects.Graphics;
    this.bg = g.card.setDepth(FORM_UI_DEPTH + 1) as Phaser.GameObjects.Graphics;

    this.titleText = scene.add
      .text(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 16, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#2c2433',
        fontStyle: 'bold',
        wordWrap: { width: Math.max(120, this.boxW - 36) },
        lineSpacing: 4,
      })
      .setDepth(FORM_UI_DEPTH + 12);
    this.titleText.setShadow(0, 1, '#ffffff', 0.45, false, true);

    this.hintText = scene.add
      .text(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 56, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#3a2f3d',
        wordWrap: { width: Math.max(120, this.boxW - 36) },
        lineSpacing: 5,
      })
      .setDepth(FORM_UI_DEPTH + 12);

    this.hide();
  }

  startToggles(args: {
    title: string;
    toggles: ToggleOption[];
    onSubmit: (values: Record<string, boolean>) => void;
  }): void {
    this.cleanupDom();
    this.clearToggleLayer();
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.84), Math.floor(this.scene.scale.height * 0.46));
    this.titleText.setText(args.title);
    this.toggles = args.toggles.map((t) => ({ ...t }));
    this.onSubmitToggles = args.onSubmit;
    this.cursor = 0;

    this.active = true;
    this.show();
    this.renderToggles();
    this.hintEnabled = true;
    this.hintText.setVisible(true);
    this.hintText.setText(
      'Flèches haut / bas : choisir une ligne • Flèches gauche / droite : Non / Oui • Espace : valider',
    );
  }

  /** Retourne true si l'input a été consommé. */
  handleToggleInput(input: { up: boolean; down: boolean; left: boolean; right: boolean; action: boolean }): boolean {
    if (!this.active) return false;
    if (!this.toggles.length) return false;

    if (input.up) {
      this.cursor = (this.cursor + this.toggles.length - 1) % this.toggles.length;
      this.renderToggles();
      return true;
    }
    if (input.down) {
      this.cursor = (this.cursor + 1) % this.toggles.length;
      this.renderToggles();
      return true;
    }
    if (input.left || input.right) {
      const t = this.toggles[this.cursor];
      if (t) t.value = !t.value;
      this.renderToggles();
      return true;
    }
    if (input.action) {
      const values: Record<string, boolean> = {};
      for (const t of this.toggles) values[t.key] = !!t.value;
      const cb = this.onSubmitToggles;
      this.stop();
      cb?.(values);
      return true;
    }
    return false;
  }

  startTextFields(args: {
    title: string;
    fields: Array<{ name: string; label: string; placeholder?: string; multiline?: boolean; maxLength?: number }>;
    defaults?: Record<string, string>;
    onSubmit: (values: Record<string, string>) => void;
  }): void {
    this.cleanupSubmit();
    this.clearToggleLayer();
    this.cleanupDom();
    // Plus haut pour éviter tout débordement (labels + 2 textareas + boutons).
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.82), Math.floor(this.scene.scale.height * 0.56));
    this.titleText.setText(args.title);
    this.active = true;
    this.show();
    // Évite qu'un bouton tactile "resté appuyé" fasse avancer une autre UI derrière.
    resetVirtualInputState();
    // En mode formulaire texte, le hint se superpose facilement -> on le masque.
    this.hintEnabled = false;
    this.hintText.setVisible(false);

    const wrap = document.createElement('div');
    wrap.style.width = '520px';
    wrap.style.maxWidth = '86vw';
    wrap.style.fontFamily = 'monospace';
    wrap.style.color = '#2c2433';
    // Laisser respirer sous le titre (qui est dessiné hors DOM)
    wrap.style.paddingTop = '10px';

    for (const f of args.fields) {
      const label = document.createElement('div');
      label.textContent = f.label;
      label.style.margin = '10px 0 4px';
      label.style.fontSize = '12px';
      wrap.appendChild(label);

      const el = f.multiline ? document.createElement('textarea') : document.createElement('input');
      (el as any).name = f.name;
      (el as any).placeholder = f.placeholder || '';
      (el as any).maxLength = f.maxLength ?? 2000;
      const def = (args.defaults?.[f.name] ?? '').toString();
      (el as any).value = def;
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
      el.style.border = '1px solid rgba(171,188,166,0.85)';
      el.style.background = 'rgba(250,246,241,0.98)';
      el.style.color = '#2c2433';
      el.style.borderRadius = '8px';
      el.style.padding = '8px 10px';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '13px';
      if (f.multiline) {
        (el as HTMLTextAreaElement).rows = 3;
        (el as HTMLTextAreaElement).style.resize = 'none';
      }
      wrap.appendChild(el);
    }

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    actions.style.marginTop = '12px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    cancel.style.padding = '8px 10px';
    cancel.style.borderRadius = '8px';
    cancel.style.border = '1px solid rgba(201,165,92,0.45)';
    cancel.style.background = 'transparent';
    cancel.style.color = '#2c2433';
    cancel.onclick = () => {
      this.stop();
      this.refocusGameCanvas();
    };

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Enregistrer';
    submit.style.padding = '8px 12px';
    submit.style.borderRadius = '8px';
    submit.style.border = '1px solid rgba(201,165,92,0.65)';
    submit.style.background = 'rgba(171,188,166,0.35)';
    submit.style.color = '#2c2433';
    submit.onclick = () => {
      const values: Record<string, string> = {};
      for (const f of args.fields) {
        const node = wrap.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
        values[f.name] = (node?.value ?? '').trim();
      }
      this.stop();
      args.onSubmit(values);
    };

    actions.appendChild(cancel);
    actions.appendChild(submit);
    wrap.appendChild(actions);

    // Centrer le formulaire dans la card (et laisser de l'air sous le titre)
    this.domElement = this.scene.add.dom(this.centerX, this.centerY + 26, wrap);
    this.domElement.setDepth(FORM_UI_DEPTH + 20);

    // IMPORTANT: pendant la saisie, on désactive le clavier Phaser sinon il capture
    // Z/Q/S/D/Espace (preventDefault) et empêche d'écrire dans les champs.
    const keyboard = this.scene.input?.keyboard as any;
    if (keyboard) {
      this.prevKeyboardEnabled = !!keyboard.enabled;
      keyboard.enabled = false;
      // Phaser peut quand même "capturer" des touches globalement.
      // disableGlobalCapture() libère Z/Q/S/D/Espace pour les inputs DOM.
      try {
        // On ne peut pas lire l'état; on mémorise qu'on l'a désactivé ici.
        keyboard.disableGlobalCapture?.();
        this.prevGlobalCaptureDisabled = true;
      } catch {
        // ignore
      }
    }

    // Raccourcis clavier pendant la saisie (Chrome): Enter valide, Escape annule.
    // Pour textarea: Shift+Enter permet un retour à la ligne.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (!this.domElement) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.stop();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const isTextArea = target?.tagName === 'TEXTAREA';
        if (isTextArea && e.shiftKey) return; // autoriser Shift+Enter dans textarea

        e.preventDefault();
        e.stopPropagation();
        submit.click();
      }
    };
    this.domKeydownHandler = onKeyDown;
    window.addEventListener('keydown', onKeyDown, true);

    // Hint masqué en mode texte
  }

  stop(): void {
    this.blurActiveElement();
    this.active = false;
    this.toggles = [];
    this.onSubmitToggles = undefined;
    this.clearToggleLayer();
    this.cleanupDom();
    this.cleanupSubmit();
    // Réactiver le hint par défaut
    this.hintEnabled = true;
    this.hintText.setVisible(true);
    this.hide();
    this.refocusGameCanvas();
  }

  private blurActiveElement(): void {
    try {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === 'function') el.blur();
    } catch {
      // ignore
    }
  }

  private refocusGameCanvas(): void {
    try {
      // Certains navigateurs réassignent le focus au <body> après blur;
      // on force un refocus différé + reset clavier Phaser.
      const canvas = this.scene.game?.canvas as any;
      const keyboard = this.scene.input?.keyboard as any;

      try {
        window.focus();
      } catch {}

      const doFocus = () => {
        try {
          if (canvas && typeof canvas.focus === 'function') canvas.focus();
        } catch {}
        try {
          if (keyboard && typeof keyboard.resetKeys === 'function') keyboard.resetKeys();
        } catch {}
      };

      setTimeout(doFocus, 0);
      try {
        requestAnimationFrame(doFocus);
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  private setBoxSize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    this.centerX = Math.floor(this.scene.scale.width / 2);
    this.centerY = Math.floor(this.scene.scale.height / 2);
    drawCardGraphics(this.shadow, this.bg, this.centerX, this.centerY, this.boxW, this.boxH);
    this.titleText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 16);
    this.titleText.setStyle({ wordWrap: { width: Math.max(120, this.boxW - 36) } });
    this.hintText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 62);
    this.hintText.setStyle({ wordWrap: { width: Math.max(120, this.boxW - 36) } });
  }

  private renderToggles(): void {
    this.clearToggleLayer();
    this.cleanupSubmit();

    const padX = 18;
    const rowW = this.boxW - padX * 2;
    const rowH = 48;
    const rowGap = 10;
    const contentTop = this.centerY - this.boxH / 2 + 56;
    const footerY = this.centerY + this.boxH / 2 - 40;

    this.toggles.forEach((t, i) => {
      const isSelected = i === this.cursor;
      const yTop = contentTop + i * (rowH + rowGap);
      const cy = yTop + rowH / 2;

      const fill = t.value ? 0xabbca6 : 0xfaf6f1;
      const fillAlpha = t.value ? 0.42 : 0.72;
      const strokeW = isSelected ? 2 : 1;
      const strokeA = isSelected ? 0.75 : 0.32;

      const rowBg = this.scene.add
        .rectangle(this.centerX, cy, rowW, rowH, fill, fillAlpha)
        .setStrokeStyle(strokeW, 0xb8956a, strokeA)
        .setDepth(FORM_UI_DEPTH + 4);

      rowBg.setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', () => {
        if (!this.active) return;
        this.cursor = i;
        const tt = this.toggles[this.cursor];
        if (tt) tt.value = !tt.value;
        this.renderToggles();
      });

      const label = this.scene.add
        .text(this.centerX - rowW / 2 + 16, cy, t.label, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#2c2433',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(FORM_UI_DEPTH + 5);
      label.setShadow(0, 1, '#ffffff', 0.35, false, true);

      const chipBg = t.value ? 'rgba(171,188,166,0.55)' : 'rgba(44,36,51,0.10)';
      const chipFg = t.value ? '#1f3a24' : '#4a3f3a';
      const chip = this.scene.add
        .text(this.centerX + rowW / 2 - 16, cy, t.value ? 'Oui' : 'Non', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: chipFg,
          fontStyle: 'bold',
          backgroundColor: chipBg,
          padding: { x: 12, y: 7 },
        })
        .setOrigin(1, 0.5)
        .setDepth(FORM_UI_DEPTH + 5);

      this.toggleLayer.push(rowBg, label, chip);
    });

    const btnW = 168;
    const btnH = 40;
    const submitX = this.centerX;
    const submitY = footerY;

    const gfx = this.scene.add.graphics().setDepth(FORM_UI_DEPTH + 8);
    const drawBtn = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0xc4a77d : 0x9e7d55, 0.92);
      gfx.fillRoundedRect(submitX - btnW / 2, submitY - btnH / 2, btnW, btnH, 8);
      gfx.lineStyle(1, 0xf2dfc3, 0.65);
      gfx.strokeRoundedRect(submitX - btnW / 2, submitY - btnH / 2, btnW, btnH, 8);
    };
    drawBtn(false);

    const lbl = this.scene.add
      .text(submitX, submitY, 'Valider', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f2dfc3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(FORM_UI_DEPTH + 9);

    const hit = this.scene.add
      .rectangle(submitX, submitY, btnW, btnH, 0x000000, 0)
      .setDepth(FORM_UI_DEPTH + 10)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => drawBtn(true));
    hit.on('pointerout', () => drawBtn(false));
    hit.on('pointerdown', () => {
      if (!this.active) return;
      const values: Record<string, boolean> = {};
      for (const tt of this.toggles) values[tt.key] = !!tt.value;
      const cb = this.onSubmitToggles;
      this.stop();
      cb?.(values);
    });

    this.submitBg = gfx;
    this.submitHit = hit;
    this.submitLabel = lbl;
  }

  private clearToggleLayer(): void {
    for (const o of this.toggleLayer) o.destroy();
    this.toggleLayer = [];
  }

  private cleanupDom(): void {
    // Réactiver le clavier Phaser si on l'a désactivé pour la saisie.
    if (this.prevKeyboardEnabled !== null) {
      try {
        const keyboard = this.scene.input?.keyboard as any;
        if (keyboard) keyboard.enabled = this.prevKeyboardEnabled;
      } catch {
        // ignore
      }
      this.prevKeyboardEnabled = null;
    }
    if (this.prevGlobalCaptureDisabled) {
      try {
        const keyboard = this.scene.input?.keyboard as any;
        keyboard?.enableGlobalCapture?.();
      } catch {
        // ignore
      }
      this.prevGlobalCaptureDisabled = null;
    }
    if (this.domKeydownHandler) {
      try {
        window.removeEventListener('keydown', this.domKeydownHandler, true);
      } catch {
        // ignore
      }
      this.domKeydownHandler = null;
    }
    if (this.domElement) {
      this.domElement.destroy();
      this.domElement = null;
    }
  }

  private cleanupSubmit(): void {
    if (this.submitHit) {
      this.submitHit.destroy();
      this.submitHit = null;
    }
    if (this.submitLabel) {
      this.submitLabel.destroy();
      this.submitLabel = null;
    }
    if (this.submitBg) {
      this.submitBg.destroy();
      this.submitBg = null;
    }
  }

  private show(): void {
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
    this.hintText.setVisible(this.hintEnabled);
    this.submitBg?.setVisible(true);
    this.submitHit?.setVisible(true);
    this.submitLabel?.setVisible(true);
  }

  private hide(): void {
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
    this.submitBg?.setVisible(false);
    this.submitHit?.setVisible(false);
    this.submitLabel?.setVisible(false);
  }
}
