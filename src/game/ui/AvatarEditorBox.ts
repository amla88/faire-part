import Phaser from 'phaser';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { createCardGraphics, drawCardGraphics } from './BridgertonCard';
import { resetVirtualInputState } from '../core/input-state';
import { gameBackend } from '../services/GameBackendBridge';
import type { AvatarOptionItem } from 'src/app/utils/avatar-dicebear-catalog';
import {
  AVATAR_ACCESSORIES_COLOR_OPTIONS,
  AVATAR_ACCESSORIES_OPTIONS,
  AVATAR_BACKGROUND_COLOR_OPTIONS,
  AVATAR_CLOTHING_GRAPHIC_OPTIONS,
  AVATAR_CLOTHING_OPTIONS,
  AVATAR_CLOTHES_COLOR_OPTIONS,
  AVATAR_EYEBROWS_OPTIONS,
  AVATAR_EYES_OPTIONS,
  AVATAR_FACIAL_HAIR_OPTIONS,
  AVATAR_HAIR_COLOR_OPTIONS,
  AVATAR_MOUTH_OPTIONS,
  AVATAR_SKIN_COLOR_OPTIONS,
  AVATAR_TOP_OPTIONS,
} from 'src/app/utils/avatar-dicebear-catalog';
import {
  type AvatarDicebearFormState,
  buildAvatarUpsertOptionsJson,
  buildDicebearCreateOptions,
  cloneAvatarDicebearFormState,
  formStateFromRpcOptions,
  randomizeAvatarDicebearForm,
} from 'src/app/utils/avatar-dicebear-form';

const FORM_KEYS: (keyof AvatarDicebearFormState)[] = [
  'top',
  'accessories',
  'accessoriesColor',
  'hairColor',
  'facialHair',
  'clothing',
  'clothingGraphic',
  'clothesColor',
  'eyes',
  'eyebrows',
  'mouth',
  'skinColor',
  'backgroundColor',
];

export class AvatarEditorBox {
  private shadow: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;

  private domElement: Phaser.GameObjects.DOMElement | null = null;
  private domKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private prevKeyboardEnabled: boolean | null = null;
  private prevGlobalCaptureDisabled: boolean | null = null;

  public active = false;
  private centerX: number;
  private centerY: number;
  private boxW: number;
  private boxH: number;

  private form: AvatarDicebearFormState = formStateFromRpcOptions(null);
  private initialSnapshot!: AvatarDicebearFormState;
  private onClose?: (saved: boolean) => void;

  private previewImg: HTMLImageElement | null = null;
  private errorEl: HTMLElement | null = null;
  private selectByKey: Partial<Record<keyof AvatarDicebearFormState, HTMLSelectElement>> = {};
  private saveBtn: HTMLButtonElement | null = null;
  private randomBtn: HTMLButtonElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.boxW = Math.floor(width * 0.94);
    this.boxH = Math.floor(height * 0.9);
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

    this.hintText = scene.add.text(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 22, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#2c2433',
    });

    this.hide();
  }

  /**
   * @param initial — réponse de `getAvatarForSelected()` (ou null).
   */
  start(args: { initial: { seed?: string; options?: unknown } | null; onClose: (saved: boolean) => void }): void {
    this.cleanupDom();
    this.onClose = args.onClose;
    this.form = formStateFromRpcOptions(args.initial?.options ?? null, args.initial?.seed ?? null);
    this.initialSnapshot = cloneAvatarDicebearFormState(this.form);

    this.setBoxSize(Math.floor(this.scene.scale.width * 0.94), Math.floor(this.scene.scale.height * 0.9));
    this.titleText.setText('La Galerie des reflets');
    this.hintText.setText('Échap : fermer sans enregistrer');
    this.active = true;
    this.show();
    resetVirtualInputState();

    const { innerW, innerH, domCenterY } = this.getContentMetrics();
    const wrap = this.buildDom(innerW, innerH);
    this.domElement = this.scene.add.dom(this.centerX, domCenterY, wrap);
    this.domElement.setDepth(1000);
    try {
      this.domElement.setOrigin(0.5, 0.5);
      const go = this.domElement as unknown as { setDisplaySize?(w: number, h: number): void };
      go.setDisplaySize?.(innerW, innerH);
    } catch {
      // ignore
    }

    const keyboard = this.scene.input?.keyboard as any;
    if (keyboard) {
      this.prevKeyboardEnabled = !!keyboard.enabled;
      keyboard.enabled = false;
      try {
        keyboard.disableGlobalCapture?.();
        this.prevGlobalCaptureDisabled = true;
      } catch {
        this.prevGlobalCaptureDisabled = null;
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.active || !this.domElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.finish(false);
      }
    };
    this.domKeydownHandler = onKeyDown;
    window.addEventListener('keydown', onKeyDown, true);

    this.refreshPreview();
  }

  /**
   * Zone utile à l’intérieur de la carte (titre + légende Phaser réservés en haut / bas).
   */
  private getContentMetrics(): { innerW: number; innerH: number; domCenterY: number } {
    const padX = 22;
    const reserveTop = 38;
    const reserveBottom = 26;
    const innerW = Math.max(252, this.boxW - padX * 2);
    const innerH = Math.max(210, this.boxH - reserveTop - reserveBottom);
    const domCenterY = this.centerY + (reserveTop - reserveBottom) / 2;
    return { innerW, innerH, domCenterY };
  }

  private buildDom(innerW: number, innerH: number): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'fp-phaser-avatar-editor';
    root.style.boxSizing = 'border-box';
    root.style.width = `${innerW}px`;
    root.style.height = `${innerH}px`;
    root.style.minHeight = `${innerH}px`;
    root.style.maxWidth = `${innerW}px`;
    root.style.maxHeight = `${innerH}px`;
    root.style.overflow = 'hidden';
    root.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
    root.style.color = '#2c2433';
    root.style.padding = '0 2px';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.minWidth = '0';
    root.style.position = 'relative';

    const previewPx = Math.min(112, Math.max(68, Math.floor(innerH * 0.23)));

    const previewStrip = document.createElement('div');
    previewStrip.style.flexShrink = '0';
    previewStrip.style.display = 'flex';
    previewStrip.style.flexDirection = 'row';
    previewStrip.style.flexWrap = 'wrap';
    previewStrip.style.alignItems = 'center';
    previewStrip.style.justifyContent = 'space-between';
    previewStrip.style.padding = '4px 6px';
    previewStrip.style.borderRadius = '10px';
    previewStrip.style.background = 'rgba(255,255,255,0.45)';
    previewStrip.style.border = '1px solid rgba(171,188,166,0.4)';

    const previewLeft = document.createElement('div');
    previewLeft.style.display = 'flex';
    previewLeft.style.flexDirection = 'row';
    previewLeft.style.alignItems = 'center';
    previewLeft.style.minWidth = '0';
    previewLeft.style.flex = '1 1 auto';
    previewLeft.style.marginRight = '10px';

    const imgWrap = document.createElement('div');
    imgWrap.style.flexShrink = '0';
    imgWrap.style.lineHeight = '0';
    imgWrap.style.marginRight = '12px';
    const img = document.createElement('img');
    img.alt = 'Aperçu';
    img.width = previewPx;
    img.height = previewPx;
    img.style.width = `${previewPx}px`;
    img.style.height = `${previewPx}px`;
    img.style.objectFit = 'contain';
    img.style.borderRadius = '10px';
    img.style.border = '1px solid rgba(171,188,166,0.85)';
    img.style.background = 'rgba(250,246,241,0.98)';
    this.previewImg = img;
    imgWrap.appendChild(img);

    const previewCopy = document.createElement('div');
    previewCopy.style.minWidth = '0';
    previewCopy.style.flex = '1 1 120px';
    const previewTitle = document.createElement('div');
    previewTitle.textContent = 'Votre portrait';
    previewTitle.style.fontSize = '12px';
    previewTitle.style.fontWeight = '700';
    previewTitle.style.letterSpacing = '0.02em';
    const previewHint = document.createElement('div');
    previewHint.textContent = 'Ajustez les menus ci-dessous — tout est enregistré avec le site.';
    previewHint.style.fontSize = '10px';
    previewHint.style.opacity = '0.78';
    previewHint.style.lineHeight = '1.35';
    previewHint.style.marginTop = '3px';
    previewCopy.appendChild(previewTitle);
    previewCopy.appendChild(previewHint);

    previewLeft.appendChild(imgWrap);
    previewLeft.appendChild(previewCopy);

    const prevActions = document.createElement('div');
    prevActions.style.display = 'flex';
    prevActions.style.flexDirection = 'row';
    prevActions.style.flexWrap = 'wrap';
    prevActions.style.flexShrink = '0';
    prevActions.style.justifyContent = 'flex-end';

    this.randomBtn = document.createElement('button');
    this.randomBtn.type = 'button';
    this.randomBtn.textContent = 'Aléatoire';
    this.randomBtn.style.marginRight = '6px';
    this.stylePrimaryBtn(this.randomBtn);
    this.randomBtn.onclick = () => {
      randomizeAvatarDicebearForm(this.form);
      this.syncSelectsFromForm();
      this.refreshPreview();
    };

    this.resetBtn = document.createElement('button');
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'Réinitialiser';
    this.styleGhostBtn(this.resetBtn);
    this.resetBtn.onclick = () => {
      Object.assign(this.form, cloneAvatarDicebearFormState(this.initialSnapshot));
      this.syncSelectsFromForm();
      this.clearError();
      this.refreshPreview();
    };

    prevActions.appendChild(this.randomBtn);
    prevActions.appendChild(this.resetBtn);
    previewStrip.appendChild(previewLeft);
    previewStrip.appendChild(prevActions);

    // Hauteur explicite : évite un flex « 1 1 0 » à 0 px sous Phaser DOM (nav + options invisibles).
    const gapRootSections = 10;
    const footerReserve = 40;
    const errReserve = 16;
    const betweenRootGaps = gapRootSections * 3;
    const fixedBottom = footerReserve + errReserve + betweenRootGaps;
    const oldPreviewReserve = Math.min(150, Math.max(88, previewPx + 52));
    const oldFooter = 42;
    const oldErr = 18;
    const oldGapBudget = 8 * 3;
    const oldScrollBaseline = Math.max(
      120,
      innerH - oldPreviewReserve - oldFooter - oldErr - oldGapBudget
    );
    const scrollTarget = Math.floor((oldScrollBaseline * 4) / 3);
    const estPreviewStrip = Math.min(118, Math.max(64, previewPx + 28));
    const scrollCap = innerH - fixedBottom - estPreviewStrip;
    let scrollHeight = Math.max(120, Math.min(scrollTarget, scrollCap));
    scrollHeight = Math.min(scrollHeight + Math.max(18, Math.floor(innerH * 0.05)), scrollCap);

    const scroll = document.createElement('div');
    scroll.style.marginTop = '10px';
    scroll.style.flex = '0 0 auto';
    scroll.style.width = '100%';
    scroll.style.height = `${scrollHeight}px`;
    scroll.style.minHeight = `${scrollHeight}px`;
    scroll.style.maxHeight = `${scrollHeight}px`;
    scroll.style.minWidth = '0';
    scroll.style.display = 'flex';
    scroll.style.flexDirection = 'column';
    scroll.style.overflow = 'hidden';
    scroll.style.padding = '2px 4px 4px 0';
    scroll.style.boxSizing = 'border-box';

    const navW = Math.min(142, Math.max(88, Math.floor(innerW * 0.3)));

    const categoriesRow = document.createElement('div');
    categoriesRow.style.flex = '1 1 auto';
    categoriesRow.style.minHeight = '0';
    categoriesRow.style.height = '100%';
    categoriesRow.style.minWidth = '0';
    categoriesRow.style.display = 'flex';
    categoriesRow.style.flexDirection = 'row';
    categoriesRow.style.alignItems = 'stretch';

    const navColumn = document.createElement('nav');
    navColumn.style.flex = `0 0 ${navW}px`;
    navColumn.style.minWidth = '0';
    navColumn.style.display = 'flex';
    navColumn.style.flexDirection = 'column';
    navColumn.style.paddingRight = '8px';
    navColumn.style.marginRight = '10px';
    navColumn.style.borderRight = '1px solid rgba(171,188,166,0.38)';
    navColumn.style.overflowY = 'auto';
    navColumn.style.overflowX = 'hidden';
    navColumn.style.setProperty('-webkit-overflow-scrolling', 'touch');
    navColumn.setAttribute('aria-label', 'Catégories');

    const optionsColumn = document.createElement('div');
    optionsColumn.style.flex = '1 1 0';
    optionsColumn.style.minWidth = '0';
    optionsColumn.style.minHeight = '0';
    optionsColumn.style.height = '100%';
    optionsColumn.style.display = 'flex';
    optionsColumn.style.flexDirection = 'column';

    const accordionPanel = document.createElement('div');
    accordionPanel.style.flex = '1 1 0';
    accordionPanel.style.minHeight = '0';
    accordionPanel.style.minWidth = '0';
    accordionPanel.style.overflowY = 'auto';
    accordionPanel.style.overflowX = 'hidden';
    accordionPanel.style.setProperty('-webkit-overflow-scrolling', 'touch');
    accordionPanel.style.boxSizing = 'border-box';

    optionsColumn.appendChild(accordionPanel);

    this.selectByKey = {};
    const categories: { title: string; fields: HTMLElement[] }[] = [
      {
        title: 'Visage & fond',
        fields: [
          this.makeSelect('eyes', 'Yeux', AVATAR_EYES_OPTIONS),
          this.makeSelect('eyebrows', 'Sourcils', AVATAR_EYEBROWS_OPTIONS),
          this.makeSelect('mouth', 'Bouche', AVATAR_MOUTH_OPTIONS),
          this.makeSelect('skinColor', 'Peau', AVATAR_SKIN_COLOR_OPTIONS),
          this.makeSelect('backgroundColor', 'Fond', AVATAR_BACKGROUND_COLOR_OPTIONS),
        ],
      },
      {
        title: 'Cheveux & barbe',
        fields: [
          this.makeSelect('top', 'Coiffure / couvre-chef', AVATAR_TOP_OPTIONS),
          this.makeSelect('hairColor', 'Couleur cheveux', AVATAR_HAIR_COLOR_OPTIONS),
          this.makeSelect('facialHair', 'Barbe ou moustache', AVATAR_FACIAL_HAIR_OPTIONS),
        ],
      },
      {
        title: 'Accessoires',
        fields: [
          this.makeSelect('accessories', 'Lunettes, etc.', AVATAR_ACCESSORIES_OPTIONS),
          this.makeSelect('accessoriesColor', 'Couleur accessoire', AVATAR_ACCESSORIES_COLOR_OPTIONS),
        ],
      },
      {
        title: 'Tenue',
        fields: [
          this.makeSelect('clothing', 'Vêtement', AVATAR_CLOTHING_OPTIONS),
          this.makeSelect('clothingGraphic', 'Motif (t-shirt)', AVATAR_CLOTHING_GRAPHIC_OPTIONS),
          this.makeSelect('clothesColor', 'Couleur tenue', AVATAR_CLOTHES_COLOR_OPTIONS),
        ],
      },
    ];

    const bodies: HTMLDivElement[] = [];
    const headers: HTMLButtonElement[] = [];

    const setAccordionOpen = (idx: number) => {
      bodies.forEach((b, j) => {
        b.style.display = j === idx ? 'block' : 'none';
      });
      headers.forEach((h, j) => {
        const on = j === idx;
        h.setAttribute('aria-expanded', on ? 'true' : 'false');
        h.style.background = on ? 'rgba(171,188,166,0.5)' : 'rgba(255,255,255,0.35)';
        h.style.border = on ? '1px solid rgba(121,140,115,0.55)' : '1px solid rgba(171,188,166,0.45)';
        h.style.fontWeight = on ? '700' : '600';
        h.style.boxShadow = on ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : 'none';
      });
    };

    for (let i = 0; i < categories.length; i++) {
      const { title, fields } = categories[i]!;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = title;
      btn.setAttribute('aria-expanded', 'false');
      this.styleAccordionHeader(btn);
      btn.addEventListener('click', () => setAccordionOpen(i));
      if (i < categories.length - 1) {
        btn.style.marginBottom = '6px';
      }
      headers.push(btn);
      navColumn.appendChild(btn);

      const body = this.categoryBody(fields);
      bodies.push(body);
      accordionPanel.appendChild(body);
    }

    setAccordionOpen(0);

    categoriesRow.appendChild(navColumn);
    categoriesRow.appendChild(optionsColumn);
    scroll.appendChild(categoriesRow);

    const err = document.createElement('p');
    err.style.margin = '10px 0 0 0';
    err.style.fontSize = '11px';
    err.style.color = '#8b2942';
    err.style.minHeight = '14px';
    err.style.lineHeight = '1.3';
    err.style.flexShrink = '0';
    this.errorEl = err;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.flexWrap = 'wrap';
    footer.style.justifyContent = 'flex-end';
    footer.style.paddingTop = '2px';
    footer.style.marginTop = '10px';
    footer.style.flexShrink = '0';

    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.textContent = 'Fermer';
    this.styleGhostBtn(this.closeBtn);
    this.closeBtn.onclick = () => this.finish(false);

    this.saveBtn = document.createElement('button');
    this.saveBtn.type = 'button';
    this.saveBtn.textContent = 'Enregistrer';
    this.saveBtn.style.marginLeft = '8px';
    this.stylePrimaryBtn(this.saveBtn);
    this.saveBtn.onclick = () => void this.submit();

    footer.appendChild(this.closeBtn);
    footer.appendChild(this.saveBtn);

    root.appendChild(previewStrip);
    root.appendChild(scroll);
    root.appendChild(err);
    root.appendChild(footer);

    this.syncSelectsFromForm();
    return root;
  }

  /** Contenu d’une catégorie (titre sur le bouton d’en-tête, pas ici). */
  private categoryBody(children: HTMLElement[]): HTMLDivElement {
    const g = document.createElement('div');
    g.style.display = 'none';
    g.style.width = '100%';
    g.style.minWidth = '0';
    g.style.border = '1px solid rgba(171,188,166,0.45)';
    g.style.borderRadius = '10px';
    g.style.padding = '8px 10px';
    g.style.background = 'rgba(255,255,255,0.35)';
    g.style.boxSizing = 'border-box';
    for (const c of children) g.appendChild(c);
    return g;
  }

  /** Bouton dans la liste verticale des catégories (colonne gauche). */
  private styleAccordionHeader(b: HTMLButtonElement): void {
    b.style.width = '100%';
    b.style.textAlign = 'left';
    b.style.padding = '9px 8px';
    b.style.borderRadius = '8px';
    b.style.border = '1px solid rgba(171,188,166,0.45)';
    b.style.background = 'rgba(255,255,255,0.35)';
    b.style.color = '#2c2433';
    b.style.cursor = 'pointer';
    b.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
    b.style.fontSize = '10px';
    b.style.fontWeight = '600';
    b.style.lineHeight = '1.3';
    b.style.touchAction = 'manipulation';
    b.style.minHeight = '40px';
    b.style.boxSizing = 'border-box';
    b.style.alignSelf = 'stretch';
  }

  private makeSelect(key: keyof AvatarDicebearFormState, label: string, items: readonly AvatarOptionItem[]): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '6px';
    const lab = document.createElement('div');
    lab.textContent = label;
    lab.style.fontSize = '10px';
    lab.style.fontWeight = '500';
    lab.style.marginBottom = '3px';
    lab.style.opacity = '0.9';
    const sel = document.createElement('select');
    sel.style.width = '100%';
    sel.style.maxWidth = '100%';
    sel.style.boxSizing = 'border-box';
    sel.style.border = '1px solid rgba(171,188,166,0.85)';
    sel.style.background = 'rgba(250,246,241,0.98)';
    sel.style.color = '#2c2433';
    sel.style.borderRadius = '8px';
    sel.style.padding = '6px 8px';
    sel.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
    sel.style.fontSize = '11px';
    for (const it of items) {
      const o = document.createElement('option');
      o.value = it.value;
      o.textContent = it.label;
      sel.appendChild(o);
    }
    sel.value = this.form[key];
    if (sel.value !== this.form[key]) {
      const o = document.createElement('option');
      o.value = this.form[key];
      o.textContent = this.form[key];
      sel.appendChild(o);
      sel.value = this.form[key];
    }
    sel.addEventListener('change', () => {
      this.form[key] = sel.value;
      this.clearError();
      this.refreshPreview();
    });
    this.selectByKey[key] = sel;
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    return wrap;
  }

  private stylePrimaryBtn(b: HTMLButtonElement): void {
    b.style.padding = '7px 11px';
    b.style.borderRadius = '8px';
    b.style.border = '1px solid rgba(201,165,92,0.65)';
    b.style.background = 'rgba(171,188,166,0.4)';
    b.style.color = '#2c2433';
    b.style.cursor = 'pointer';
    b.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
    b.style.fontSize = '11px';
    b.style.fontWeight = '600';
    b.style.touchAction = 'manipulation';
    b.style.whiteSpace = 'nowrap';
  }

  private styleGhostBtn(b: HTMLButtonElement): void {
    b.style.padding = '7px 11px';
    b.style.borderRadius = '8px';
    b.style.border = '1px solid rgba(201,165,92,0.45)';
    b.style.background = 'transparent';
    b.style.color = '#2c2433';
    b.style.cursor = 'pointer';
    b.style.fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";
    b.style.fontSize = '11px';
    b.style.fontWeight = '600';
    b.style.touchAction = 'manipulation';
    b.style.whiteSpace = 'nowrap';
  }

  private syncSelectsFromForm(): void {
    for (const key of FORM_KEYS) {
      const sel = this.selectByKey[key];
      if (!sel) continue;
      sel.value = this.form[key];
      if (sel.value !== this.form[key]) {
        const o = document.createElement('option');
        o.value = this.form[key];
        o.textContent = this.form[key];
        sel.appendChild(o);
        sel.value = this.form[key];
      }
    }
  }

  private refreshPreview(): void {
    if (!this.previewImg) return;
    try {
      const opts = buildDicebearCreateOptions(this.form, 256);
      const avatar = createAvatar(avataaars, opts);
      this.previewImg.src = avatar.toDataUri();
    } catch {
      this.previewImg.src = '';
    }
  }

  private clearError(): void {
    if (this.errorEl) this.errorEl.textContent = '';
  }

  private setBusy(saving: boolean): void {
    for (const b of [this.saveBtn, this.randomBtn, this.resetBtn, this.closeBtn]) {
      if (b) b.disabled = saving;
    }
  }

  private async submit(): Promise<void> {
    this.clearError();
    this.setBusy(true);
    try {
      const opts = buildAvatarUpsertOptionsJson(this.form);
      const dataUri = createAvatar(avataaars, buildDicebearCreateOptions(this.form, 256)).toDataUri();
      await gameBackend.upsertAvatarForSelected(this.form.seed, opts, dataUri);
      this.finish(true);
    } catch (e: any) {
      const msg = String(e?.message || e || 'Erreur');
      if (this.errorEl) this.errorEl.textContent = msg;
    } finally {
      this.setBusy(false);
    }
  }

  private finish(saved: boolean): void {
    const cb = this.onClose;
    this.onClose = undefined;
    this.stop();
    cb?.(saved);
  }

  stop(): void {
    this.blurActiveElement();
    this.active = false;
    this.cleanupDom();
    this.previewImg = null;
    this.errorEl = null;
    this.saveBtn = null;
    this.randomBtn = null;
    this.resetBtn = null;
    this.closeBtn = null;
    this.selectByKey = {};
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
      const canvas = this.scene.game?.canvas as any;
      const keyboard = this.scene.input?.keyboard as any;
      try {
        window.focus();
      } catch {
        // ignore
      }
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

  private setBoxSize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    this.centerX = Math.floor(this.scene.scale.width / 2);
    this.centerY = Math.floor(this.scene.scale.height / 2);
    drawCardGraphics(this.shadow, this.bg, this.centerX, this.centerY, this.boxW, this.boxH);
    this.titleText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY - this.boxH / 2 + 14);
    this.hintText.setPosition(this.centerX - this.boxW / 2 + 18, this.centerY + this.boxH / 2 - 22);
  }

  private cleanupDom(): void {
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

  private show(): void {
    this.shadow.setVisible(true);
    this.bg.setVisible(true);
    this.titleText.setVisible(true);
    this.hintText.setVisible(true);
  }

  private hide(): void {
    this.shadow.setVisible(false);
    this.bg.setVisible(false);
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
  }
}
