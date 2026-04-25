import Phaser from 'phaser';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { resetVirtualInputState } from '../core/input-state';
import type { GameFamilyPhoto } from '../services/GameBackendBridge';

const PHOTO_UI_DEPTH = 100_520;

const BTN = {
  borderG: 'rgba(201,165,92,0.5)',
  borderGStrong: 'rgba(184,149,106,0.95)',
  grad: 'linear-gradient(180deg, #c4a77d 0%, #9e7d55 100%)',
  gradH: 'linear-gradient(180deg, #d4b78d 0%, #a88d65 100%)',
  textLight: '#f2dfc3',
  ink: '#2c2433',
  cream: '#faf6f1',
  sage: 'rgba(171,188,166,0.9)',
} as const;

function stylePrimary(btn: HTMLButtonElement): void {
  btn.type = 'button';
  btn.style.fontFamily = 'monospace, ui-monospace, monospace';
  btn.style.fontSize = '13px';
  btn.style.fontWeight = '700';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '5px';
  btn.style.padding = '10px 16px';
  btn.style.border = `1px solid ${BTN.borderGStrong}`;
  btn.style.background = BTN.grad;
  btn.style.color = BTN.textLight;
  btn.onmouseenter = () => { btn.style.background = BTN.gradH; };
  btn.onmouseleave = () => { btn.style.background = BTN.grad; };
}

function styleGhost(btn: HTMLButtonElement): void {
  btn.type = 'button';
  btn.style.fontFamily = 'monospace, ui-monospace, monospace';
  btn.style.fontSize = '13px';
  btn.style.fontWeight = '600';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '5px';
  btn.style.padding = '10px 16px';
  btn.style.border = `1px solid ${BTN.borderG}`;
  btn.style.background = 'rgba(255,255,255,0.3)';
  btn.style.color = BTN.ink;
  btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.5)'; };
  btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.3)'; };
}

export class PhotoUploadBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;
  private prevGlobalCaptureDisabled: boolean | null = null;
  private onPanelClose: (() => void) | null = null;
  private onEnd: ((didUpload: boolean) => void) | null = null;
  private didUpload = false;

  public active = false;
  private centerX: number;
  private centerY: number;
  private boxW: number;
  private boxH: number;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.boxW = Math.floor(width * 0.86);
    this.boxH = Math.floor(height * 0.74);
    this.centerX = Math.floor(width / 2);
    this.centerY = Math.floor(height / 2);

    const g = createCardGraphics(scene, this.centerX, this.centerY, this.boxW, this.boxH);
    this.shadow = g.shadow;
    this.bg = g.card;
    this.shadow.setDepth(PHOTO_UI_DEPTH);
    this.bg.setDepth(PHOTO_UI_DEPTH + 1);

    this.titleText = scene.add
      .text(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 16, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2c2433',
        fontStyle: 'bold',
      })
      .setDepth(PHOTO_UI_DEPTH + 2);

    this.hide();
  }

  start(args: {
    title: string;
    loadPhotos: () => Promise<GameFamilyPhoto[]>;
    onDeletePhoto: (key: string) => Promise<void>;
    onUpload: (file: File) => Promise<void>;
    onUploadSuccess?: () => void;
    /** Fermeture : masque HUD (ex. sceneHudMaskPop). */
    onPanelClose: () => void;
    /** Fermeture : retour menu (didUpload si un envoi a réussi dans cette session). */
    onEnd: (didUpload: boolean) => void;
  }): void {
    this.cleanup();
    this.onPanelClose = args.onPanelClose;
    this.onEnd = args.onEnd;
    this.didUpload = false;
    this.setBoxSize(
      Math.floor(this.scene.scale.width * 0.9),
      Math.min(Math.floor(this.scene.scale.height * 0.72), 520),
    );
    this.titleText.setText(args.title);
    this.active = true;
    this.show();
    resetVirtualInputState();

    const contentTop = this.centerY - this.boxH / 2 + 48;
    const contentWidth = this.boxW - 28;

    const wrap = document.createElement('div');
    wrap.style.boxSizing = 'border-box';
    wrap.style.width = `${contentWidth}px`;
    wrap.style.maxWidth = '100%';
    wrap.style.maxHeight = `${this.boxH - 52}px`;
    wrap.style.overflowY = 'auto';
    wrap.style.overflowX = 'hidden';
    wrap.style.fontFamily = 'monospace, ui-monospace, monospace';
    wrap.style.color = BTN.ink;
    wrap.style.padding = '2px 6px 10px';
    const loadMsg = document.createElement('div');
    loadMsg.style.fontSize = '12px';
    loadMsg.style.opacity = '0.9';
    loadMsg.textContent = 'Chargement de l’album…';
    wrap.appendChild(loadMsg);

    this.domElement = this.scene.add.dom(this.centerX, contentTop, wrap);
    this.domElement.setOrigin(0.5, 0);
    this.domElement.setDepth(PHOTO_UI_DEPTH + 10);

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
        this.endSession(false);
      }
    };
    this.domKeydownHandler = onKeyDown;
    window.addEventListener('keydown', onKeyDown, true);

    void (async () => {
      let photos: GameFamilyPhoto[] = [];
      try {
        photos = await args.loadPhotos();
      } catch {
        loadMsg.textContent = 'Impossible de charger l’album. Réessayez plus tard.';
        const b = document.createElement('button');
        b.textContent = 'Fermer';
        b.style.marginTop = '8px';
        styleGhost(b);
        b.onclick = () => this.endSession(false);
        loadMsg.parentElement?.appendChild(b);
        return;
      }
      loadMsg.remove();

      const main = document.createElement('div');
      main.style.display = 'flex';
      main.style.flexDirection = 'row';
      main.style.flexWrap = 'wrap';
      main.style.gap = '12px';
      main.style.alignItems = 'flex-start';
      main.style.width = '100%';

      const leftCol = document.createElement('div');
      leftCol.style.flex = '1 1 200px';
      leftCol.style.minWidth = '0';
      leftCol.style.maxWidth = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.gap = '8px';

      const rightW = Math.min(210, Math.max(150, Math.floor(this.scene.scale.width * 0.26)));
      const rightCol = document.createElement('div');
      rightCol.style.display = 'flex';
      rightCol.style.flexDirection = 'column';
      rightCol.style.gap = '6px';
      rightCol.style.width = `${rightW}px`;
      rightCol.style.flex = `0 0 ${rightW}px`;
      rightCol.style.maxWidth = '100%';
      if (this.scene.scale.width < 700) {
        main.style.flexDirection = 'column';
        rightCol.style.width = '100%';
        rightCol.style.flex = '1 1 auto';
        leftCol.style.maxWidth = '100%';
      }

      const albumHeader = document.createElement('div');
      albumHeader.textContent = 'Déjà dans l’album';
      albumHeader.style.fontSize = '12px';
      albumHeader.style.fontWeight = '700';
      albumHeader.style.color = '#5c5048';
      albumHeader.style.borderBottom = `1px solid ${BTN.sage}`;
      albumHeader.style.paddingBottom = '4px';

      const albumMount = document.createElement('div');
      albumMount.style.flex = '0 0 auto';
      albumMount.style.maxHeight = '240px';
      albumMount.style.overflowY = 'auto';
      albumMount.style.overflowX = 'hidden';
      rightCol.appendChild(albumHeader);
      rightCol.appendChild(albumMount);

      const fileHint = document.createElement('div');
      fileHint.textContent = 'Nouveau cliché (HEIC accepté — côté serveur)';
      fileHint.style.fontSize = '12px';
      fileHint.style.opacity = '0.95';

      const controlsRow = document.createElement('div');
      controlsRow.style.display = 'flex';
      controlsRow.style.flexWrap = 'wrap';
      controlsRow.style.gap = '6px';
      controlsRow.style.alignItems = 'center';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.heic,.heif';
      input.style.flex = '1 1 100px';
      input.style.minWidth = '0';
      input.style.fontSize = '12px';
      const cancel = document.createElement('button');
      cancel.textContent = 'Annuler';
      styleGhost(cancel);
      cancel.style.flex = '0 0 auto';
      const submit = document.createElement('button');
      submit.textContent = 'Envoyer';
      stylePrimary(submit);
      submit.style.flex = '0 0 auto';
      let busy = false;
      const previewShell = document.createElement('div');
      previewShell.style.boxSizing = 'border-box';
      previewShell.style.width = '100%';
      previewShell.style.height = '200px';
      previewShell.style.minHeight = '140px';
      previewShell.style.maxHeight = '200px';
      previewShell.style.flexShrink = '0';
      previewShell.style.display = 'flex';
      previewShell.style.alignItems = 'center';
      previewShell.style.justifyContent = 'center';
      previewShell.style.background = BTN.cream;
      previewShell.style.border = `1px solid ${BTN.sage}`;
      previewShell.style.borderRadius = '8px';
      previewShell.style.overflow = 'hidden';

      const preview = document.createElement('img');
      preview.style.display = 'none';
      preview.style.maxWidth = '100%';
      preview.style.maxHeight = '100%';
      preview.style.width = 'auto';
      preview.style.height = 'auto';
      preview.style.objectFit = 'contain';
      previewShell.appendChild(preview);

      const placeholderHint = document.createElement('div');
      placeholderHint.textContent = 'Aperçu du fichier choisi';
      placeholderHint.style.fontSize = '12px';
      placeholderHint.style.color = '#6a5f66';
      placeholderHint.style.textAlign = 'center';
      placeholderHint.style.padding = '10px';
      previewShell.appendChild(placeholderHint);

      const status = document.createElement('div');
      status.style.fontSize = '12px';
      status.style.minHeight = '16px';
      status.style.color = '#5c5048';

      let objectUrl: string | null = null;
      const cleanupLocalPreview = () => {
        try {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
        objectUrl = null;
      };

      let albumSnapshot: GameFamilyPhoto[] = [...photos];

      const renderAlbum = (items: GameFamilyPhoto[]) => {
        albumSnapshot = items.slice();
        albumMount.textContent = '';
        if (items.length === 0) {
          const t = document.createElement('div');
          t.style.fontSize = '11px';
          t.style.color = '#6a5f66';
          t.textContent = 'Aucune photo en album pour l’instant.';
          t.style.lineHeight = '1.4';
          albumMount.appendChild(t);
          return;
        }
        const grid = document.createElement('div');
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.gap = '6px';
        for (const p of items) {
          const cell = document.createElement('div');
          cell.style.position = 'relative';
          cell.style.width = '64px';
          cell.style.height = '64px';
          cell.style.flex = '0 0 auto';
          cell.style.borderRadius = '6px';
          cell.style.overflow = 'hidden';
          cell.style.border = `1px solid ${BTN.sage}`;
          cell.style.background = '#ede8e2';
          const im = document.createElement('img');
          im.src = p.url;
          im.alt = '';
          im.style.width = '100%';
          im.style.height = '100%';
          im.style.objectFit = 'cover';
          im.onerror = () => {
            im.replaceWith(Object.assign(document.createElement('div'), { textContent: '?' }));
          };
          const x = document.createElement('button');
          x.type = 'button';
          x.textContent = '×';
          x.setAttribute('aria-label', 'Supprimer');
          x.style.position = 'absolute';
          x.style.top = '2px';
          x.style.right = '2px';
          x.style.width = '20px';
          x.style.height = '20px';
          x.style.lineHeight = '18px';
          x.style.fontSize = '14px';
          x.style.fontWeight = '700';
          x.style.padding = '0';
          x.style.border = 'none';
          x.style.borderRadius = '3px';
          x.style.cursor = 'pointer';
          x.style.background = 'rgba(0,0,0,0.55)';
          x.style.color = '#fff';
          const k = p.key;
          x.onclick = async () => {
            if (x.disabled) return;
            x.disabled = true;
            status.textContent = 'Suppression…';
            try {
              await args.onDeletePhoto(k);
              try {
                const again = await args.loadPhotos();
                renderAlbum(again);
                status.textContent = '';
              } catch {
                const fallback = albumSnapshot.filter((p) => p.key !== k);
                renderAlbum(fallback);
                status.textContent = 'Rafraîchissement du serveur impossible — la grille a été mise à jour localement.';
              }
            } catch (e: unknown) {
              x.disabled = false;
              status.textContent = 'Erreur: ' + String((e as Error)?.message || e);
            }
          };
          cell.appendChild(im);
          cell.appendChild(x);
          grid.appendChild(cell);
        }
        albumMount.appendChild(grid);
      };

      renderAlbum(photos);

      input.onchange = () => {
        status.textContent = '';
        cleanupLocalPreview();
        preview.style.display = 'none';
        const f = input.files && input.files[0] ? input.files[0] : null;
        if (!f) {
          placeholderHint.style.display = 'block';
          return;
        }
        try {
          objectUrl = URL.createObjectURL(f);
          preview.src = objectUrl;
          preview.style.display = 'block';
          placeholderHint.style.display = 'none';
        } catch {
          // ignore
        }
      };

      cancel.onclick = () => {
        if (busy) return;
        cleanupLocalPreview();
        this.endSession(false);
      };

      submit.onclick = async () => {
        if (busy) return;
        const f = input.files && input.files[0] ? input.files[0] : null;
        if (!f) {
          status.textContent = 'Choisissez d’abord une image à envoyer.';
          return;
        }
        busy = true;
        status.textContent = 'Envoi en cours…';
        try {
          await args.onUpload(f);
          args.onUploadSuccess?.();
          cleanupLocalPreview();
          input.value = '';
          preview.style.display = 'none';
          placeholderHint.style.display = 'block';
          this.endSession(true);
        } catch (e: unknown) {
          status.textContent = 'Erreur: ' + String((e as Error)?.message || e);
        } finally {
          busy = false;
        }
      };

      controlsRow.appendChild(input);
      controlsRow.appendChild(cancel);
      controlsRow.appendChild(submit);
      leftCol.appendChild(fileHint);
      leftCol.appendChild(controlsRow);
      leftCol.appendChild(previewShell);
      leftCol.appendChild(status);
      main.appendChild(leftCol);
      main.appendChild(rightCol);
      wrap.appendChild(main);
    })();
  }

  private endSession(did: boolean): void {
    this.didUpload = did;
    this.stop();
  }

  /**
   * Fermeture forcée (ex. ouverture Carte du domaine) : dépile le masque, sans `onEnd` (pas de retour menu).
   */
  abort(): void {
    if (!this.active) return;
    this.active = false;
    this.didUpload = false;
    this.cleanup();
    this.hide();
    const p = this.onPanelClose;
    this.onPanelClose = null;
    this.onEnd = null;
    p?.();
    this.refocusGameCanvas();
  }

  stop(): void {
    const uploaded = this.didUpload;
    this.active = false;
    this.didUpload = false;
    this.cleanup();
    this.hide();
    const p = this.onPanelClose;
    this.onPanelClose = null;
    p?.();
    this.onEnd?.(uploaded);
    this.onEnd = null;
    this.refocusGameCanvas();
  }

  private setBoxSize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    this.centerX = Math.floor(this.scene.scale.width / 2);
    this.centerY = Math.floor(this.scene.scale.height / 2);
    drawCardGraphics(this.shadow, this.bg, this.centerX, this.centerY, this.boxW, this.boxH);
    this.titleText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 16);
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
        } catch {
          // ignore
        }
        try {
          if (keyboard && typeof keyboard.resetKeys === 'function') keyboard.resetKeys();
        } catch {
          // ignore
        }
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
