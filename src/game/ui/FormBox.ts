import Phaser from 'phaser';
import { resetVirtualInputState } from '../core/input-state';
import {
  popGameModalTouchOverlayBlock,
  pushGameModalTouchOverlayBlock,
} from '../core/modal-touch-overlay-bridge';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { sceneHudMaskPop, sceneHudMaskPush } from './scene-hud-mask';

export type ToggleOption = { key: string; label: string; value: boolean };

/** Au-dessus des textes UI de scène (souvent ~100000) pour éviter qu’ils recouvrent le formulaire. */
const FORM_UI_DEPTH = 100_520;

/** Couleurs alignées sur la carte Bridgerton — champs sur le fond crème Phaser (pas de « double carte »). */
const FORM_TEXT_DOM = {
  ink: '#2c2433',
  inkMuted: '#5c5048',
  creamPaper: '#faf6f1',
  borderSage: 'rgba(171,188,166,0.95)',
  borderGold: 'rgba(184,149,106,0.5)',
  borderGoldStrong: 'rgba(184,149,106,0.95)',
  focusRing: '0 0 0 2px rgba(184,149,106,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
  submitText: '#f2dfc3',
  submitBg: 'linear-gradient(180deg, #c4a77d 0%, #9e7d55 100%)',
  submitBgHover: 'linear-gradient(180deg, #d4b78d 0%, #a88d65 100%)',
} as const;

function styleTextField(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.style.outline = 'none';
  el.style.transition = 'border-color 0.15s ease, box-shadow 0.15s ease';
  const relax = () => {
    el.style.borderColor = FORM_TEXT_DOM.borderSage;
    el.style.boxShadow = 'none';
  };
  const focus = () => {
    el.style.borderColor = FORM_TEXT_DOM.borderGoldStrong;
    el.style.boxShadow = FORM_TEXT_DOM.focusRing;
  };
  el.addEventListener('focus', focus);
  el.addEventListener('blur', relax);
}

function styleFormButton(
  btn: HTMLButtonElement,
  variant: 'primary' | 'ghost',
): void {
  btn.style.fontFamily = 'monospace';
  btn.style.fontSize = '13px';
  btn.style.fontWeight = variant === 'primary' ? '700' : '600';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '5px';
  btn.style.padding = '10px 16px';
  btn.style.transition = 'filter 0.15s ease, background 0.15s ease, border-color 0.15s ease';
  if (variant === 'primary') {
    btn.style.border = `1px solid ${FORM_TEXT_DOM.borderGoldStrong}`;
    btn.style.background = FORM_TEXT_DOM.submitBg;
    btn.style.color = FORM_TEXT_DOM.submitText;
    btn.style.textShadow = '0 1px 0 rgba(44,36,51,0.25)';
    btn.onmouseenter = () => {
      btn.style.background = FORM_TEXT_DOM.submitBgHover;
      btn.style.filter = 'brightness(1.03)';
    };
    btn.onmouseleave = () => {
      btn.style.background = FORM_TEXT_DOM.submitBg;
      btn.style.filter = 'none';
    };
  } else {
    btn.style.border = `1px solid ${FORM_TEXT_DOM.borderGold}`;
    btn.style.background = 'rgba(255,255,255,0.25)';
    btn.style.color = FORM_TEXT_DOM.ink;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.45)';
      btn.style.borderColor = FORM_TEXT_DOM.borderGoldStrong;
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255,255,255,0.25)';
      btn.style.borderColor = FORM_TEXT_DOM.borderGold;
    };
  }
}

/** Mise en page du mode bascules : hauteur minimale dérivée du nombre de lignes (évite chevauchement hint / lignes). */
const TOGGLE_TITLE_TOP = 52;
const TOGGLE_ROW_H = 44;
const TOGGLE_ROW_GAP = 8;
const TOGGLE_HINT_BAND = 50;
const TOGGLE_BTN_H = 36;
const TOGGLE_FOOT_PAD = 12;

function minToggleBoxHeight(numRows: number): number {
  const rowsH = numRows * TOGGLE_ROW_H + Math.max(0, numRows - 1) * TOGGLE_ROW_GAP;
  return TOGGLE_TITLE_TOP + rowsH + TOGGLE_HINT_BAND + TOGGLE_BTN_H + TOGGLE_FOOT_PAD * 2;
}

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
  private sceneHudMaskApplied = false;
  private touchOverlayBlocked = false;
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
        fontSize: '12px',
        color: '#3a2f3d',
        wordWrap: { width: Math.max(120, this.boxW - 36) },
        lineSpacing: 4,
      })
      .setOrigin(0, 1)
      .setDepth(FORM_UI_DEPTH + 12);

    this.hide();
  }

  startToggles(args: {
    title: string;
    toggles: ToggleOption[];
    onSubmit: (values: Record<string, boolean>) => void;
    hideSceneHud?: Phaser.GameObjects.GameObject[];
  }): void {
    this.cleanupDom();
    this.clearToggleLayer();
    const n = args.toggles.length;
    const minH = minToggleBoxHeight(n);
    const sh = this.scene.scale.height;
    const h = Math.min(Math.floor(sh * 0.9), Math.max(minH, Math.floor(sh * 0.34)));
    this.setBoxSize(Math.floor(this.scene.scale.width * 0.84), h);
    this.titleText.setText(args.title);
    this.toggles = args.toggles.map((t) => ({ ...t }));
    this.normalizeDeclineRowIfPresent();
    this.onSubmitToggles = args.onSubmit;
    this.cursor = 0;

    this.applySceneHudMask(args.hideSceneHud);
    this.active = true;
    if (!this.touchOverlayBlocked) {
      pushGameModalTouchOverlayBlock();
      this.touchOverlayBlocked = true;
    }
    this.show();
    this.renderToggles();
    this.hintEnabled = true;
    this.hintText.setVisible(true);
    const hasDecline = this.toggles.some((t) => t.key === 'decline_invitation');
    this.hintText.setText(
      hasDecline
        ? '↑↓ ligne • ←→ Non / Oui • « Ne participe pas » = refus total (événements affichés) • Espace : valider'
        : '↑↓ ligne • ←→ Non / Oui • Espace : valider',
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
      if (!t) return true;
      if (this.isDeclineLockedForKey(t.key)) return true;
      t.value = !t.value;
      this.applyDeclinePresenceRules(t.key);
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
    /** Sous-titre discret sous le titre (aligné avec la carte). */
    subtitle?: string;
    fields: Array<{ name: string; label: string; placeholder?: string; multiline?: boolean; maxLength?: number }>;
    defaults?: Record<string, string>;
    onSubmit: (values: Record<string, string>) => void;
    hideSceneHud?: Phaser.GameObjects.GameObject[];
  }): void {
    this.cleanupSubmit();
    this.clearToggleLayer();
    this.cleanupDom();
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    // Carte Phaser = cadre blanc : doit couvrir titre + sous-titre + champs + boutons (DOM calé dedans).
    this.setBoxSize(Math.floor(sw * 0.78), Math.floor(sh * 0.75));
    this.titleText.setText('');
    this.applySceneHudMask(args.hideSceneHud);
    this.active = true;
    if (!this.touchOverlayBlocked) {
      pushGameModalTouchOverlayBlock();
      this.touchOverlayBlocked = true;
    }
    this.show();
    this.titleText.setVisible(false);
    resetVirtualInputState();
    this.hintEnabled = false;
    this.hintText.setVisible(false);

    const padX = 22;
    const padY = 14;
    const innerW = Math.max(200, this.boxW - padX * 2);
    const innerH = Math.max(180, this.boxH - padY * 2);

    const wrap = document.createElement('div');
    wrap.id = 'fp-form-text-inner';
    wrap.style.boxSizing = 'border-box';
    wrap.style.width = `${innerW}px`;
    wrap.style.maxWidth = `${innerW}px`;
    wrap.style.height = `${innerH}px`;
    wrap.style.maxHeight = `${innerH}px`;
    wrap.style.margin = '0';
    wrap.style.padding = '0';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.position = 'relative';
    wrap.style.fontFamily = 'monospace, ui-monospace, monospace';
    wrap.style.color = FORM_TEXT_DOM.ink;
    wrap.style.background = 'transparent';
    wrap.style.border = 'none';
    wrap.style.minHeight = '0';
    // Évite que le flex dépasse la hauteur fixe : sinon les boutons se retrouvent sous le Graphics Phaser.
    wrap.style.overflow = 'hidden';

    const phStyle = document.createElement('style');
    phStyle.textContent =
      `#fp-form-text-inner input::placeholder, #fp-form-text-inner textarea::placeholder { color: ${FORM_TEXT_DOM.inkMuted}; opacity: 0.9; }` +
      `#fp-form-text-inner input, #fp-form-text-inner textarea { image-rendering: auto; }` +
      `#fp-form-text-scroll::-webkit-scrollbar { width: 8px; }` +
      `#fp-form-text-scroll::-webkit-scrollbar-thumb { background: rgba(44,36,51,0.22); border-radius: 4px; }`;

    const titleEl = document.createElement('div');
    titleEl.setAttribute('role', 'heading');
    titleEl.setAttribute('aria-level', '2');
    titleEl.textContent = args.title;
    titleEl.style.margin = '0';
    titleEl.style.padding = '0 10px 10px';
    titleEl.style.fontFamily = 'monospace, ui-monospace, monospace';
    titleEl.style.fontSize = '16px';
    titleEl.style.fontWeight = '700';
    titleEl.style.lineHeight = '1.3';
    titleEl.style.textAlign = 'center';
    titleEl.style.color = FORM_TEXT_DOM.ink;
    titleEl.style.borderBottom = `1px solid ${FORM_TEXT_DOM.borderGold}`;
    titleEl.style.textShadow = '0 1px 0 rgba(255,255,255,0.75)';
    titleEl.style.flexShrink = '0';

    wrap.appendChild(phStyle);
    wrap.appendChild(titleEl);

    if (args.subtitle?.trim()) {
      const sub = document.createElement('p');
      sub.textContent = args.subtitle.trim();
      sub.style.margin = '0 0 10px';
      sub.style.padding = '8px 12px 0';
      sub.style.fontFamily = 'monospace, ui-monospace, monospace';
      sub.style.fontSize = '12px';
      sub.style.lineHeight = '1.45';
      sub.style.textAlign = 'center';
      sub.style.color = FORM_TEXT_DOM.inkMuted;
      sub.style.wordBreak = 'break-word';
      sub.style.flexShrink = '0';
      wrap.appendChild(sub);
    }

    const scrollArea = document.createElement('div');
    scrollArea.id = 'fp-form-text-scroll';
    // base 0 : la zone scroll prend l’espace *restant* sans pousser le pied hors du cadre
    scrollArea.style.flex = '1 1 0';
    scrollArea.style.minHeight = '0';
    scrollArea.style.overflowY = 'auto';
    scrollArea.style.overflowX = 'hidden';
    scrollArea.style.padding = '2px 2px 0';

    for (const [fi, f] of args.fields.entries()) {
      const label = document.createElement('div');
      label.textContent = f.label;
      label.style.margin = fi === 0 ? '4px 0 6px' : '10px 0 6px';
      label.style.fontFamily = 'monospace, ui-monospace, monospace';
      label.style.fontSize = '13px';
      label.style.fontWeight = '700';
      label.style.color = FORM_TEXT_DOM.ink;
      label.style.letterSpacing = '0.03em';
      scrollArea.appendChild(label);

      const el = f.multiline ? document.createElement('textarea') : document.createElement('input');
      (el as any).name = f.name;
      (el as any).placeholder = f.placeholder || '';
      (el as any).maxLength = f.maxLength ?? 2000;
      const def = (args.defaults?.[f.name] ?? '').toString();
      (el as any).value = def;
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
      el.style.border = `2px solid ${FORM_TEXT_DOM.borderSage}`;
      el.style.background = FORM_TEXT_DOM.creamPaper;
      el.style.color = FORM_TEXT_DOM.ink;
      el.style.borderRadius = '4px';
      el.style.padding = '10px 12px';
      el.style.fontFamily = 'monospace, ui-monospace, monospace';
      el.style.fontSize = '13px';
      el.style.lineHeight = '1.5';
      if (f.multiline) {
        (el as HTMLTextAreaElement).rows = 3;
        (el as HTMLTextAreaElement).style.minHeight = '72px';
        (el as HTMLTextAreaElement).style.resize = 'none';
      }
      styleTextField(el as HTMLInputElement | HTMLTextAreaElement);
      scrollArea.appendChild(el);
    }

    wrap.appendChild(scrollArea);

    // Même « carte » crème que le titre (fond Phaser) : pas de second encadré HTML.
    const actions = document.createElement('div');
    actions.id = 'fp-form-actions-row';
    actions.style.boxSizing = 'border-box';
    actions.style.width = '100%';
    actions.style.flexShrink = '0';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.alignItems = 'center';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '10px';
    actions.style.marginTop = '4px';
    actions.style.paddingTop = '12px';
    actions.style.borderTop = `1px solid ${FORM_TEXT_DOM.borderGold}`;

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    styleFormButton(cancel, 'ghost');
    cancel.onclick = () => {
      this.stop();
      this.refocusGameCanvas();
    };

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Enregistrer';
    styleFormButton(submit, 'primary');
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

    const domX = this.centerX - this.boxW / 2 + padX;
    const domY = this.centerY - this.boxH / 2 + padY;
    this.domElement = this.scene.add.dom(domX, domY, wrap);
    this.domElement.setOrigin(0, 0);
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
    if (this.touchOverlayBlocked) {
      popGameModalTouchOverlayBlock();
      this.touchOverlayBlocked = false;
    }
    this.releaseSceneHudMaskIfAny();
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

  private applySceneHudMask(objects: Phaser.GameObjects.GameObject[] | undefined): void {
    if (!objects?.length) return;
    sceneHudMaskPush(this.scene, objects);
    this.sceneHudMaskApplied = true;
  }

  private releaseSceneHudMaskIfAny(): void {
    if (!this.sceneHudMaskApplied) return;
    sceneHudMaskPop(this.scene);
    this.sceneHudMaskApplied = false;
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
    this.hintText.setStyle({ wordWrap: { width: Math.max(120, this.boxW - 36) } });
  }

  private renderToggles(): void {
    this.clearToggleLayer();
    this.cleanupSubmit();

    const padX = 18;
    const rowW = this.boxW - padX * 2;
    const rowH = TOGGLE_ROW_H;
    const rowGap = TOGGLE_ROW_GAP;
    const contentTop = this.centerY - this.boxH / 2 + TOGGLE_TITLE_TOP;
    const submitY = this.centerY + this.boxH / 2 - TOGGLE_FOOT_PAD - TOGGLE_BTN_H / 2;
    const hintBottomY = submitY - TOGGLE_BTN_H / 2 - 8;
    this.hintText.setPosition(this.centerX - this.boxW / 2 + padX, hintBottomY);

    this.toggles.forEach((t, i) => {
      const isSelected = i === this.cursor;
      const yTop = contentTop + i * (rowH + rowGap);
      const cy = yTop + rowH / 2;

      const declineLocksRow = this.isDeclineLockedForKey(t.key);
      const locked = declineLocksRow;

      const fill = t.value ? 0xabbca6 : 0xfaf6f1;
      const fillAlpha = t.value ? 0.42 : 0.72;
      const strokeW = isSelected ? 2 : 1;
      const strokeA = isSelected ? 0.75 : 0.32;

      const rowBg = this.scene.add
        .rectangle(this.centerX, cy, rowW, rowH, fill, fillAlpha)
        .setStrokeStyle(strokeW, 0xb8956a, strokeA)
        .setDepth(FORM_UI_DEPTH + 4);

      const rowMutable = !declineLocksRow;
      rowBg.setInteractive({ useHandCursor: rowMutable });
      rowBg.on('pointerdown', () => {
        if (!this.active) return;
        this.cursor = i;
        const tt = this.toggles[this.cursor];
        if (!tt) return;
        if (this.isDeclineLockedForKey(tt.key)) return;
        tt.value = !tt.value;
        this.applyDeclinePresenceRules(tt.key);
        this.renderToggles();
      });

      const labelColor = locked ? '#6a5f66' : '#2c2433';
      const label = this.scene.add
        .text(this.centerX - rowW / 2 + 16, cy, t.label, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: labelColor,
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(FORM_UI_DEPTH + 5);
      label.setShadow(0, 1, '#ffffff', 0.35, false, true);

      const chipBg = t.value ? 'rgba(171,188,166,0.55)' : 'rgba(44,36,51,0.10)';
      const chipFg = locked ? '#7a706c' : t.value ? '#1f3a24' : '#4a3f3a';
      const chipLabel =
        t.key === 'decline_invitation' ? (t.value ? 'Oui (refus)' : 'Non') : t.value ? 'Oui' : 'Non';
      const chip = this.scene.add
        .text(this.centerX + rowW / 2 - 16, cy, chipLabel, {
          fontFamily: 'monospace',
          fontSize: locked ? '12px' : '13px',
          color: chipFg,
          fontStyle: 'bold',
          backgroundColor: chipBg,
          padding: { x: 10, y: 6 },
        })
        .setOrigin(1, 0.5)
        .setDepth(FORM_UI_DEPTH + 5);

      this.toggleLayer.push(rowBg, label, chip);
    });

    const btnW = 168;
    const btnH = TOGGLE_BTN_H;
    const submitX = this.centerX;

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

  /** Si une ligne « decline_invitation » existe et est à Oui, les présences ne sont plus modifiables. */
  private isDeclineLockedForKey(key: string): boolean {
    if (key === 'decline_invitation') return false;
    const d = this.toggles.find((x) => x.key === 'decline_invitation');
    return !!d?.value;
  }

  private normalizeDeclineRowIfPresent(): void {
    const decline = this.toggles.find((t) => t.key === 'decline_invitation');
    if (!decline) return;
    if (decline.value) {
      for (const t of this.toggles) {
        if (t.key !== 'decline_invitation') t.value = false;
      }
    }
  }

  private applyDeclinePresenceRules(changedKey: string): void {
    const decline = this.toggles.find((t) => t.key === 'decline_invitation');
    if (!decline) return;
    const presents = this.toggles.filter((t) => t.key !== 'decline_invitation');
    if (changedKey === 'decline_invitation' && decline.value) {
      for (const p of presents) p.value = false;
      return;
    }
    if (changedKey !== 'decline_invitation') {
      for (const p of presents) {
        if (p.value) {
          decline.value = false;
          return;
        }
      }
    }
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
