import Phaser from 'phaser';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { resetVirtualInputState } from '../core/input-state';

type AvatarOptions = Record<string, any>;

export class AvatarBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;
  private prevGlobalCaptureDisabled: boolean | null = null;

  public active = false;
  private centerX: number;
  private centerY: number;
  private boxW: number;
  private boxH: number;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.boxW = Math.floor(width * 0.86);
    this.boxH = Math.floor(height * 0.68);
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

    this.hide();
  }

  start(args: {
    title: string;
    defaults?: { seed?: string; options?: AvatarOptions };
    onSubmit: (payload: { seed: string; options: AvatarOptions }) => void;
  }): void {
    this.cleanup();
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.86), Math.floor(this.scene.scale.height * 0.70));
    this.titleText.setText(args.title);
    this.active = true;
    this.show();
    resetVirtualInputState();

    const seedDefault = (args.defaults?.seed ?? '').toString() || 'invité';
    const optionsDefault = (args.defaults?.options ?? {}) as AvatarOptions;

    const wrap = document.createElement('div');
    wrap.style.width = '560px';
    wrap.style.maxWidth = '90vw';
    wrap.style.maxHeight = '60vh';
    wrap.style.overflow = 'auto';
    wrap.style.fontFamily = 'monospace';
    wrap.style.color = '#2c2433';
    wrap.style.paddingTop = '8px';

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 220px';
    row.style.gap = '14px';

    const left = document.createElement('div');
    const right = document.createElement('div');

    const preview = document.createElement('div');
    preview.style.width = '220px';
    preview.style.height = '220px';
    preview.style.border = '1px solid rgba(171,188,166,0.85)';
    preview.style.borderRadius = '10px';
    preview.style.background = 'rgba(250,246,241,0.98)';
    preview.style.display = 'grid';
    preview.style.placeItems = 'center';
    preview.style.overflow = 'hidden';

    const previewInner = document.createElement('div');
    previewInner.style.width = '200px';
    previewInner.style.height = '200px';
    preview.appendChild(previewInner);
    right.appendChild(preview);

    const mkLabel = (txt: string) => {
      const label = document.createElement('div');
      label.textContent = txt;
      label.style.margin = '10px 0 4px';
      label.style.fontSize = '12px';
      return label;
    };

    const mkInput = (name: string, placeholder: string) => {
      const el = document.createElement('input');
      el.name = name;
      el.placeholder = placeholder;
      el.maxLength = 80;
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
      el.style.border = '1px solid rgba(171,188,166,0.85)';
      el.style.background = 'rgba(250,246,241,0.98)';
      el.style.color = '#2c2433';
      el.style.borderRadius = '8px';
      el.style.padding = '8px 10px';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '13px';
      return el;
    };

    const mkSelect = (name: string, options: Array<{ value: string; label: string }>) => {
      const el = document.createElement('select');
      el.name = name;
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
      el.style.border = '1px solid rgba(171,188,166,0.85)';
      el.style.background = 'rgba(250,246,241,0.98)';
      el.style.color = '#2c2433';
      el.style.borderRadius = '8px';
      el.style.padding = '8px 10px';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '13px';
      for (const o of options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        el.appendChild(opt);
      }
      return el;
    };

    left.appendChild(mkLabel('Graine (seed)'));
    const seedEl = mkInput('seed', 'ex: Camille-2026');
    seedEl.value = seedDefault;
    left.appendChild(seedEl);

    left.appendChild(mkLabel('Cheveux (top)'));
    const topEl = mkSelect('top', [
      { value: 'shortHair', label: 'Courts' },
      { value: 'longHair', label: 'Longs' },
      { value: 'hat', label: 'Chapeau' },
      { value: 'turban', label: 'Turban' },
      { value: 'hijab', label: 'Voile' },
      { value: 'noHair', label: 'Sans cheveux' },
    ]);
    topEl.value = String(optionsDefault?.['top'] ?? 'shortHair');
    left.appendChild(topEl);

    left.appendChild(mkLabel('Accessoire'));
    const accessoriesEl = mkSelect('accessories', [
      { value: 'blank', label: 'Aucun' },
      { value: 'kurt', label: 'Lunettes' },
      { value: 'prescription01', label: 'Lunettes fines' },
      { value: 'prescription02', label: 'Lunettes rondes' },
      { value: 'round', label: 'Monocle (rond)' },
    ]);
    accessoriesEl.value = String(optionsDefault?.['accessories'] ?? 'blank');
    left.appendChild(accessoriesEl);

    left.appendChild(mkLabel('Vêtements'));
    const clothesEl = mkSelect('clothes', [
      { value: 'blazerShirt', label: 'Blazer + chemise' },
      { value: 'hoodie', label: 'Hoodie' },
      { value: 'overall', label: 'Salopette' },
      { value: 'shirtCrewNeck', label: 'T-shirt' },
      { value: 'shirtScoopNeck', label: 'T-shirt col rond' },
    ]);
    clothesEl.value = String(optionsDefault?.['clothes'] ?? 'blazerShirt');
    left.appendChild(clothesEl);

    const hint = document.createElement('div');
    hint.style.marginTop = '10px';
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.85';
    hint.textContent = 'Astuce: modifiez les options, puis validez. Le jeu sauvegarde dans Supabase.';
    left.appendChild(hint);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    actions.style.marginTop = '14px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Fermer';
    cancel.style.padding = '8px 10px';
    cancel.style.borderRadius = '8px';
    cancel.style.border = '1px solid rgba(201,165,92,0.45)';
    cancel.style.background = 'transparent';
    cancel.style.color = '#2c2433';
    cancel.onclick = () => {
      this.stop();
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
      const seed = (seedEl.value ?? '').trim() || 'invité';
      const options: AvatarOptions = {
        top: topEl.value,
        accessories: accessoriesEl.value,
        clothes: clothesEl.value,
      };
      this.stop();
      args.onSubmit({ seed, options });
    };

    actions.appendChild(cancel);
    actions.appendChild(submit);
    left.appendChild(actions);

    row.appendChild(left);
    row.appendChild(right);
    wrap.appendChild(row);

    const renderPreview = () => {
      try {
        const seed = (seedEl.value ?? '').trim() || 'invité';
        const options: AvatarOptions = {
          top: topEl.value,
          accessories: accessoriesEl.value,
          clothes: clothesEl.value,
        };
        const svg = createAvatar(avataaars, { seed, ...options }).toString();
        previewInner.innerHTML = svg;
        const svgEl = previewInner.querySelector('svg') as SVGElement | null;
        if (svgEl) {
          (svgEl as any).style.width = '200px';
          (svgEl as any).style.height = '200px';
        }
      } catch {
        // ignore
      }
    };

    seedEl.addEventListener('input', renderPreview);
    topEl.addEventListener('change', renderPreview);
    accessoriesEl.addEventListener('change', renderPreview);
    clothesEl.addEventListener('change', renderPreview);
    renderPreview();

    this.domElement = this.scene.add.dom(this.centerX, this.centerY + 26, wrap);
    this.domElement.setDepth(1000);

    const keyboard = this.scene.input?.keyboard as any;
    if (keyboard) {
      this.prevKeyboardEnabled = !!keyboard.enabled;
      keyboard.enabled = false;
      try {
        keyboard.disableGlobalCapture?.();
        this.prevGlobalCaptureDisabled = true;
      } catch {
        // ignore
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.stop();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        submit.click();
      }
    };
    this.domKeydownHandler = onKeyDown;
    window.addEventListener('keydown', onKeyDown, true);
  }

  stop(): void {
    this.active = false;
    this.cleanup();
    this.hide();
    this.refocusGameCanvas();
  }

  private setBoxSize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    this.centerX = Math.floor(this.scene.scale.width / 2);
    this.centerY = Math.floor(this.scene.scale.height / 2);
    drawCardGraphics(this.shadow, this.bg, this.centerX, this.centerY, this.boxW, this.boxH);
    this.titleText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 14);
  }

  private cleanup(): void {
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

  private refocusGameCanvas(): void {
    try {
      const canvas = this.scene.game?.canvas as any;
      const keyboard = this.scene.input?.keyboard as any;
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

  private show(): void {
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
  }

  private hide(): void {
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
  }
}

