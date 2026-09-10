import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AvatarLabelFamille,
  AvatarLabelPerson,
  AvatarLabelSettings,
  DEFAULT_LABEL_BACKGROUND,
  expandLabelJobs,
} from './avatar-label-export.types';
import { AVATAR_PLACEHOLDER_SRC } from './admin-avatars.utils';

const EXPORT_DPI = 300;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_MARGIN_MM = 8;
const A4_MIN_GAP_MM = 1.2;

interface LabelRenderAssets {
  bg: HTMLImageElement;
}

interface A4LabelLayout {
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  offsetX: number;
  offsetY: number;
  perPage: number;
}

@Injectable({ providedIn: 'root' })
export class AvatarLabelExportService {
  async exportPdf(famille: AvatarLabelFamille, settings: AvatarLabelSettings): Promise<void> {
    const jobs = expandLabelJobs([famille], settings, AVATAR_PLACEHOLDER_SRC);
    const orientation =
      settings.widthMm >= settings.heightMm ? ('landscape' as const) : ('portrait' as const);
    const pdf = new jsPDF({
      unit: 'mm',
      format: [settings.widthMm, settings.heightMm],
      orientation,
      compress: true,
    });

    for (let i = 0; i < jobs.length; i++) {
      if (i > 0) {
        pdf.addPage([settings.widthMm, settings.heightMm], orientation);
      }
      const canvas = await this.renderLabelCanvas(jobs[i], settings);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, settings.widthMm, settings.heightMm);
    }

    const slug = this.fileSlug(famille.displayName);
    const suffix = jobs.length > 1 ? '-par-personne' : '';
    pdf.save(`etiquette-${slug}${suffix}.pdf`);
  }

  async exportAllLabelsA4Pdf(
    familles: AvatarLabelFamille[],
    settings: AvatarLabelSettings
  ): Promise<void> {
    const jobs = expandLabelJobs(familles, settings, AVATAR_PLACEHOLDER_SRC);
    if (jobs.length === 0) {
      throw new Error('Aucune étiquette à exporter');
    }

    const bgSrc = settings.backgroundDataUrl ?? DEFAULT_LABEL_BACKGROUND;
    const assets: LabelRenderAssets = {
      bg: await this.loadBackground(bgSrc, this.mmToPx(settings.widthMm), this.mmToPx(settings.heightMm)),
    };

    const layout = this.computeA4Layout(settings.widthMm, settings.heightMm);
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });

    for (let i = 0; i < jobs.length; i++) {
      const posOnPage = i % layout.perPage;
      if (i > 0 && posOnPage === 0) {
        pdf.addPage('a4', 'portrait');
      }

      const col = posOnPage % layout.cols;
      const row = Math.floor(posOnPage / layout.cols);
      const x = layout.offsetX + col * (settings.widthMm + layout.gapX);
      const y = layout.offsetY + row * (settings.heightMm + layout.gapY);

      const canvas = await this.renderLabelCanvas(jobs[i], settings, assets);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', x, y, settings.widthMm, settings.heightMm);
      this.drawLabelCutGuide(pdf, x, y, settings.widthMm, settings.heightMm);
    }

    this.drawA4PageFooters(pdf, layout, settings, jobs.length);
    pdf.save(this.allLabelsFilename());
  }

  async exportPng(famille: AvatarLabelFamille, settings: AvatarLabelSettings): Promise<void> {
    const canvas = await this.renderLabelCanvas(famille, settings);
    const slug = this.fileSlug(famille.displayName);
    this.downloadDataUrl(canvas.toDataURL('image/png'), `etiquette-${slug}.png`);
  }

  async previewDataUrl(famille: AvatarLabelFamille, settings: AvatarLabelSettings): Promise<string> {
    const canvas = await this.renderLabelCanvas(famille, settings);
    return canvas.toDataURL('image/png');
  }

  private allLabelsFilename(): string {
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `etiquettes-toutes-familles-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.pdf`;
  }

  private computeA4Layout(labelW: number, labelH: number): A4LabelLayout {
    const usableW = A4_WIDTH_MM - A4_MARGIN_MM * 2;
    const usableH = A4_HEIGHT_MM - A4_MARGIN_MM * 2;
    const maxCols = Math.max(1, Math.floor((usableW + A4_MIN_GAP_MM) / (labelW + A4_MIN_GAP_MM)));
    const maxRows = Math.max(1, Math.floor((usableH + A4_MIN_GAP_MM) / (labelH + A4_MIN_GAP_MM)));

    let best: A4LabelLayout = {
      cols: 1,
      rows: 1,
      gapX: 0,
      gapY: 0,
      offsetX: A4_MARGIN_MM,
      offsetY: A4_MARGIN_MM,
      perPage: 1,
    };

    for (let cols = 1; cols <= maxCols; cols++) {
      for (let rows = 1; rows <= maxRows; rows++) {
        const perPage = cols * rows;
        const gapX = cols > 1 ? (usableW - cols * labelW) / (cols - 1) : 0;
        const gapY = rows > 1 ? (usableH - rows * labelH) / (rows - 1) : 0;
        if (cols > 1 && gapX + 0.01 < A4_MIN_GAP_MM) continue;
        if (rows > 1 && gapY + 0.01 < A4_MIN_GAP_MM) continue;
        const gridW = cols * labelW + Math.max(0, cols - 1) * gapX;
        const gridH = rows * labelH + Math.max(0, rows - 1) * gapY;
        if (gridW > usableW + 0.01 || gridH > usableH + 0.01) continue;

        if (perPage > best.perPage) {
          best = {
            cols,
            rows,
            gapX,
            gapY,
            offsetX: A4_MARGIN_MM + (usableW - gridW) / 2,
            offsetY: A4_MARGIN_MM + (usableH - gridH) / 2,
            perPage,
          };
        }
      }
    }

    return best;
  }

  private drawLabelCutGuide(pdf: jsPDF, x: number, y: number, w: number, h: number): void {
    pdf.setDrawColor(190, 190, 190);
    pdf.setLineWidth(0.12);
    pdf.rect(x, y, w, h, 'S');
  }

  private drawA4PageFooters(
    pdf: jsPDF,
    layout: A4LabelLayout,
    settings: AvatarLabelSettings,
    totalLabels: number
  ): void {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(130, 130, 130);
      const labelsOnPage = Math.min(
        layout.perPage,
        totalLabels - (page - 1) * layout.perPage
      );
      pdf.text(
        `Étiquettes ${settings.widthMm}×${settings.heightMm} mm — ${labelsOnPage} par page — ${page}/${pageCount}`,
        A4_WIDTH_MM / 2,
        A4_HEIGHT_MM - 4,
        { align: 'center' }
      );
    }
    pdf.setTextColor(0, 0, 0);
  }

  private fileSlug(name: string): string {
    return (name || 'famille')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48) || 'famille';
  }

  private downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private mmToPx(mm: number): number {
    return Math.round((mm / 25.4) * EXPORT_DPI);
  }

  private async renderLabelCanvas(
    famille: AvatarLabelFamille,
    settings: AvatarLabelSettings,
    assets?: LabelRenderAssets
  ): Promise<HTMLCanvasElement> {
    const wPx = this.mmToPx(settings.widthMm);
    const hPx = this.mmToPx(settings.heightMm);
    const canvas = document.createElement('canvas');
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');

    const bgSrc = settings.backgroundDataUrl ?? DEFAULT_LABEL_BACKGROUND;
    const bg = assets?.bg ?? (await this.loadBackground(bgSrc, wPx, hPx));

    ctx.drawImage(bg, 0, 0, wPx, hPx);

    ctx.fillStyle = 'rgba(255, 248, 230, 0.08)';
    ctx.fillRect(0, 0, wPx, hPx);

    const inset = Math.max(2, Math.round(hPx * 0.045));
    ctx.strokeStyle = 'rgba(184, 149, 80, 0.9)';
    ctx.lineWidth = Math.max(1.2, hPx * 0.028);
    ctx.strokeRect(inset, inset, wPx - inset * 2, hPx - inset * 2);
    ctx.strokeStyle = 'rgba(232, 206, 140, 0.45)';
    ctx.lineWidth = Math.max(0.8, hPx * 0.012);
    ctx.strokeRect(inset + 2, inset + 2, wPx - (inset + 2) * 2, hPx - (inset + 2) * 2);

    const person = this.resolveLabelPerson(famille);
    let avatarImg: HTMLImageElement;
    try {
      avatarImg = await this.loadImage(person.imageSrc);
    } catch {
      avatarImg = await this.loadImage(AVATAR_PLACEHOLDER_SRC);
    }
    this.drawCompactPerson(ctx, person, avatarImg, wPx, hPx);

    return canvas;
  }

  private resolveLabelPerson(famille: AvatarLabelFamille): AvatarLabelPerson {
    return (
      famille.personnes[0] ?? {
        prenom: famille.displayName || '?',
        nom: '',
        imageSrc: AVATAR_PLACEHOLDER_SRC,
      }
    );
  }

  private drawCompactPerson(
    ctx: CanvasRenderingContext2D,
    person: AvatarLabelPerson,
    avatarImg: HTMLImageElement,
    wPx: number,
    hPx: number
  ): void {
    const pad = Math.max(5, hPx * 0.1);
    const avatarR = Math.max(8, (hPx - pad * 2) * 0.46);
    const ax = pad + avatarR;
    const ay = hPx / 2;
    this.drawCircularAvatar(ctx, avatarImg, ax, ay, avatarR);

    const textX = ax + avatarR + pad * 0.75;
    const textW = Math.max(12, wPx - pad - textX);
    const prenom = (person.prenom || '').trim();
    const nom = (person.nom || '').trim();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#3a2a22';

    if (prenom && nom) {
      const prenomSize = this.fitFontSize(ctx, prenom, textW, hPx * 0.26, hPx * 0.14, 700);
      const nomSize = this.fitFontSize(ctx, nom, textW, hPx * 0.2, hPx * 0.11, 600);
      ctx.font = `700 ${prenomSize}px Georgia, "Times New Roman", serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(prenom, textX, ay - hPx * 0.04, textW);
      ctx.fillStyle = 'rgba(58, 42, 34, 0.78)';
      ctx.font = `600 ${nomSize}px Georgia, "Times New Roman", serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(nom, textX, ay + hPx * 0.02, textW);
      return;
    }

    const single = prenom || nom || '?';
    const size = this.fitFontSize(ctx, single, textW, hPx * 0.28, hPx * 0.14, 700);
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(single, textX, ay, textW);
  }

  private fitFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    weight: number
  ): number {
    let size = maxSize;
    while (size > minSize) {
      ctx.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 0.4;
    }
    return minSize;
  }

  private drawCircularAvatar(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cx: number,
    cy: number,
    radius: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(196, 163, 74, 0.95)';
    ctx.lineWidth = Math.max(1.6, radius * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232, 210, 140, 0.65)';
    ctx.lineWidth = Math.max(0.8, radius * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
  }

  private async loadBackground(src: string, wPx: number, hPx: number): Promise<HTMLImageElement> {
    try {
      return await this.loadImage(src);
    } catch {
      const c = document.createElement('canvas');
      c.width = Math.max(8, wPx);
      c.height = Math.max(8, hPx);
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, wPx, hPx);
        grad.addColorStop(0, '#f3e3c4');
        grad.addColorStop(0.45, '#ead4a8');
        grad.addColorStop(1, '#dcc48a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, wPx, hPx);
      }
      return this.loadImage(c.toDataURL('image/png'));
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image introuvable : ${src.slice(0, 80)}`));
      img.src = src;
    });
  }
}
