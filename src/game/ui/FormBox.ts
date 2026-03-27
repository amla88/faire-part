import Phaser from 'phaser';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';

export type ToggleOption = { key: string; label: string; value: boolean };

export class FormBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private linesText: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private submitText: Phaser.GameObjects.Text | null = null;

  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;

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
    this.shadow = g.shadow;
    this.bg = g.card;

    this.titleText = scene.add.text(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 14, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2c2433',
    });

    this.hintText = scene.add.text(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 26, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#2c2433',
    });

    this.hide();
  }

  startToggles(args: {
    title: string;
    toggles: ToggleOption[];
    onSubmit: (values: Record<string, boolean>) => void;
  }): void {
    this.cleanupDom();
    this.clearLines();
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.78), Math.floor(this.scene.scale.height * 0.34));
    this.titleText.setText(args.title);
    this.toggles = args.toggles.map((t) => ({ ...t }));
    this.onSubmitToggles = args.onSubmit;
    this.cursor = 0;

    this.active = true;
    this.show();
    this.renderToggles();
    this.hintEnabled = true;
    this.hintText.setVisible(true);
    this.hintText.setText('Taper une ligne pour changer • Espace/Enter ou bouton tactile pour valider');
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
    onSubmit: (values: Record<string, string>) => void;
  }): void {
    this.clearLines();
    this.cleanupDom();
    // Plus haut pour éviter tout débordement (labels + 2 textareas + boutons).
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.82), Math.floor(this.scene.scale.height * 0.56));
    this.titleText.setText(args.title);
    this.active = true;
    this.show();
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
    this.domElement.setDepth(1000);

    // IMPORTANT: pendant la saisie, on désactive le clavier Phaser sinon il capture
    // Z/Q/S/D/Espace (preventDefault) et empêche d'écrire dans les champs.
    const keyboard = this.scene.input?.keyboard as any;
    if (keyboard) {
      this.prevKeyboardEnabled = !!keyboard.enabled;
      keyboard.enabled = false;
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
    this.clearLines();
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
    this.titleText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 14);
    this.hintText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 26);
  }

  private renderToggles(): void {
    this.clearLines();
    this.cleanupSubmit();
    const x0 = Math.floor(this.centerX - this.boxW / 2 + 18);
    const y0 = Math.floor(this.centerY - this.boxH / 2 + 44);

    this.linesText = this.toggles.map((t, i) => {
      const prefix = i === this.cursor ? '▶ ' : '  ';
      const val = t.value ? 'Oui' : 'Non';
      const line = this.scene.add.text(x0, y0 + i * 22, `${prefix}${t.label}: ${val}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: i === this.cursor ? '#2c2433' : '#2c2433',
      });
      line.setInteractive({ useHandCursor: true });
      line.on('pointerdown', () => {
        if (!this.active) return;
        const same = this.cursor === i;
        this.cursor = i;
        if (same) {
          const tt = this.toggles[this.cursor];
          if (tt) tt.value = !tt.value;
        }
        this.renderToggles();
      });
      return line;
    });

    const submit = this.scene.add.text(x0 + this.boxW - 130, y0 + this.boxH - 72, '[ Valider ]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#2c2433',
    });
    submit.setInteractive({ useHandCursor: true });
    submit.on('pointerdown', () => {
      if (!this.active) return;
      const values: Record<string, boolean> = {};
      for (const t of this.toggles) values[t.key] = !!t.value;
      const cb = this.onSubmitToggles;
      this.stop();
      cb?.(values);
    });
    this.submitText = submit;
  }

  private clearLines(): void {
    for (const t of this.linesText) t.destroy();
    this.linesText = [];
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
    if (this.submitText) {
      this.submitText.destroy();
      this.submitText = null;
    }
  }

  private show(): void {
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
    this.hintText.setVisible(this.hintEnabled);
  }

  private hide(): void {
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
  }
}

