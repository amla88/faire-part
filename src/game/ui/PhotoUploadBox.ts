import Phaser from 'phaser';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { resetVirtualInputState } from '../core/input-state';

export class PhotoUploadBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;
  private prevGlobalCaptureDisabled: boolean | null = null;

  public active = false;
  private onCloseCallback: (() => void) | null = null;
  private centerX: number;
  private centerY: number;
  private boxW: number;
  private boxH: number;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.boxW = Math.floor(width * 0.86);
    this.boxH = Math.floor(height * 0.70);
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
    onSubmit: (file: File) => Promise<void>;
    onDone?: () => void;
    /** Appelé à chaque fermeture (annulation, erreur après tentative, ou après succès + onDone). */
    onClose?: () => void;
  }): void {
    this.cleanup();
    this.onCloseCallback = args.onClose ?? null;
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.86), Math.floor(this.scene.scale.height * 0.72));
    this.titleText.setText(args.title);
    this.active = true;
    this.show();
    resetVirtualInputState();

    const wrap = document.createElement('div');
    wrap.style.width = '560px';
    wrap.style.maxWidth = '90vw';
    wrap.style.maxHeight = '60vh';
    wrap.style.overflow = 'auto';
    wrap.style.fontFamily = 'monospace';
    wrap.style.color = '#2c2433';
    wrap.style.paddingTop = '8px';

    const hint = document.createElement('div');
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.9';
    hint.textContent = 'Choisissez une photo (HEIC accepté). Le serveur la convertit et la publie dans votre album.';
    wrap.appendChild(hint);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.style.display = 'block';
    input.style.marginTop = '10px';
    wrap.appendChild(input);

    const preview = document.createElement('img');
    preview.style.marginTop = '10px';
    preview.style.width = '100%';
    preview.style.maxHeight = '280px';
    preview.style.objectFit = 'contain';
    preview.style.borderRadius = '10px';
    preview.style.border = '1px solid rgba(171,188,166,0.85)';
    preview.style.background = 'rgba(250,246,241,0.98)';
    wrap.appendChild(preview);

    let objectUrl: string | null = null;
    const cleanupPreview = () => {
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } catch {}
      objectUrl = null;
      preview.removeAttribute('src');
    };

    input.onchange = () => {
      cleanupPreview();
      const f = input.files && input.files[0] ? input.files[0] : null;
      if (!f) return;
      try {
        objectUrl = URL.createObjectURL(f);
        preview.src = objectUrl;
      } catch {
        // ignore preview failure
      }
    };

    const status = document.createElement('div');
    status.style.marginTop = '10px';
    status.style.fontSize = '12px';
    status.style.opacity = '0.9';
    wrap.appendChild(status);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    actions.style.marginTop = '14px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    cancel.style.padding = '8px 10px';
    cancel.style.borderRadius = '8px';
    cancel.style.border = '1px solid rgba(201,165,92,0.45)';
    cancel.style.background = 'transparent';
    cancel.style.color = '#2c2433';
    cancel.onclick = () => {
      cleanupPreview();
      this.stop();
    };

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Envoyer';
    submit.style.padding = '8px 12px';
    submit.style.borderRadius = '8px';
    submit.style.border = '1px solid rgba(201,165,92,0.65)';
    submit.style.background = 'rgba(171,188,166,0.35)';
    submit.style.color = '#2c2433';

    let busy = false;
    submit.onclick = async () => {
      if (busy) return;
      const f = input.files && input.files[0] ? input.files[0] : null;
      if (!f) {
        status.textContent = 'Choisissez une photo d’abord.';
        return;
      }
      busy = true;
      status.textContent = 'Envoi en cours…';
      try {
        await args.onSubmit(f);
        status.textContent = 'Photo enregistrée.';
        cleanupPreview();
        this.stop();
        args.onDone?.();
      } catch (e: any) {
        status.textContent = 'Erreur: ' + String(e?.message || e);
      } finally {
        busy = false;
      }
    };

    actions.appendChild(cancel);
    actions.appendChild(submit);
    wrap.appendChild(actions);

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
        cleanupPreview();
        this.stop();
      }
    };
    this.domKeydownHandler = onKeyDown;
    window.addEventListener('keydown', onKeyDown, true);
  }

  stop(): void {
    this.active = false;
    this.cleanup();
    this.hide();
    const oc = this.onCloseCallback;
    this.onCloseCallback = null;
    oc?.();
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
      } catch {}
      this.prevKeyboardEnabled = null;
    }
    if (this.prevGlobalCaptureDisabled) {
      try {
        const keyboard = this.scene.input?.keyboard as any;
        keyboard?.enableGlobalCapture?.();
      } catch {}
      this.prevGlobalCaptureDisabled = null;
    }
    if (this.domKeydownHandler) {
      try {
        window.removeEventListener('keydown', this.domKeydownHandler, true);
      } catch {}
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
      } catch {}
    } catch {}
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

