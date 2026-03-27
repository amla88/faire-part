import Phaser from 'phaser';

export type ToggleOption = { key: string; label: string; value: boolean };

export class FormBox {
  private bg: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private linesText: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private submitText: Phaser.GameObjects.Text | null = null;

  private domElement: Phaser.GameObjects.DOMElement | null = null;

  public active = false;
  private cursor = 0;
  private toggles: ToggleOption[] = [];
  private onSubmitToggles?: (values: Record<string, boolean>) => void;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    const boxW = Math.floor(width * 0.78);
    const boxH = Math.floor(height * 0.34);
    const x = Math.floor(width / 2);
    const y = Math.floor(height / 2);

    // Palette "vert sauge" (alignée sur le site: --bridgerton-sage #abbca6)
    const sageDeep = 0x2a3228;
    const sage = 0xabbca6;

    this.bg = scene.add.rectangle(x, y, boxW, boxH, sageDeep, 0.96);
    this.bg.setStrokeStyle(2, sage, 0.65);

    this.titleText = scene.add.text(x - boxW / 2 + 18, y - boxH / 2 + 14, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#faf6f1',
    });

    this.hintText = scene.add.text(x - boxW / 2 + 18, y + boxH / 2 - 26, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f3ebe4',
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
    this.titleText.setText(args.title);
    this.toggles = args.toggles.map((t) => ({ ...t }));
    this.onSubmitToggles = args.onSubmit;
    this.cursor = 0;

    this.active = true;
    this.show();
    this.renderToggles();
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
    this.titleText.setText(args.title);
    this.active = true;
    this.show();

    const wrap = document.createElement('div');
    wrap.style.width = '520px';
    wrap.style.maxWidth = '86vw';
    wrap.style.fontFamily = 'monospace';
    wrap.style.color = '#f3ebe4';

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
      el.style.border = '1px solid rgba(171,188,166,0.75)';
      el.style.background = 'rgba(42,50,40,0.92)';
      el.style.color = '#faf6f1';
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
    cancel.style.color = '#f3ebe4';
    cancel.onclick = () => this.stop();

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Enregistrer';
    submit.style.padding = '8px 12px';
    submit.style.borderRadius = '8px';
    submit.style.border = '1px solid rgba(201,165,92,0.65)';
    submit.style.background = 'rgba(171,188,166,0.22)';
    submit.style.color = '#faf6f1';
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

    this.domElement = this.scene.add.dom(this.scene.scale.width / 2, this.scene.scale.height / 2 + 28, wrap);
    this.domElement.setDepth(1000);

    this.hintText.setText('Saisie directe dans la fenêtre • bouton Enregistrer');
  }

  stop(): void {
    this.active = false;
    this.toggles = [];
    this.onSubmitToggles = undefined;
    this.clearLines();
    this.cleanupDom();
    this.cleanupSubmit();
    this.hide();
  }

  private renderToggles(): void {
    this.clearLines();
    this.cleanupSubmit();
    const { width, height } = this.scene.scale;
    const boxW = Math.floor(width * 0.78);
    const boxH = Math.floor(height * 0.34);
    const x0 = Math.floor(width / 2 - boxW / 2 + 18);
    const y0 = Math.floor(height / 2 - boxH / 2 + 44);

    this.linesText = this.toggles.map((t, i) => {
      const prefix = i === this.cursor ? '▶ ' : '  ';
      const val = t.value ? 'Oui' : 'Non';
      const line = this.scene.add.text(x0, y0 + i * 22, `${prefix}${t.label}: ${val}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: i === this.cursor ? '#faf6f1' : '#f3ebe4',
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

    const submit = this.scene.add.text(x0 + boxW - 130, y0 + boxH - 72, '[ Valider ]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#faf6f1',
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
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
    this.hintText.setVisible(true);
  }

  private hide(): void {
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
  }
}

