import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AvatarLabelFamille,
  AvatarLabelPerson,
  AvatarLabelSettings,
  DEFAULT_LABEL_BACKGROUND,
  expandLabelJobs,
  WEDDING_LOGO_SRC,
} from './avatar-label-export.types';
import { AVATAR_PLACEHOLDER_SRC } from './admin-avatars.utils';

const EXPORT_DPI = 300;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_MARGIN_MM = 10;

interface LabelRenderAssets {
  bg: HTMLImageElement;
  logo: HTMLImageElement;
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
      bg: await this.loadImage(bgSrc),
      logo: await this.loadImage(WEDDING_LOGO_SRC),
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

  private allLabelsFilename(): string {
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `etiquettes-toutes-familles-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.pdf`;
  }

  private computeA4Layout(labelW: number, labelH: number): A4LabelLayout {
    const usableW = A4_WIDTH_MM - A4_MARGIN_MM * 2;
    const usableH = A4_HEIGHT_MM - A4_MARGIN_MM * 2;
    const maxCols = Math.max(1, Math.floor(usableW / labelW));
    const maxRows = Math.max(1, Math.floor(usableH / labelH));

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
    const [bg, logo] = assets
      ? [assets.bg, assets.logo]
      : await Promise.all([this.loadImage(bgSrc), this.loadImage(WEDDING_LOGO_SRC)]);

    ctx.drawImage(bg, 0, 0, wPx, hPx);

    // Voile crème léger pour lisibilité
    ctx.fillStyle = 'rgba(255, 252, 248, 0.12)';
    ctx.fillRect(0, 0, wPx, hPx);

    const midX = wPx / 2;
    ctx.strokeStyle = 'rgba(184, 150, 90, 0.55)';
    ctx.lineWidth = Math.max(1, wPx * 0.004);
    ctx.setLineDash([wPx * 0.01, wPx * 0.008]);
    ctx.beginPath();
    ctx.moveTo(midX, hPx * 0.1);
    ctx.lineTo(midX, hPx * 0.9);
    ctx.stroke();
    ctx.setLineDash([]);

    await this.drawAvatars(ctx, famille.personnes, 0, 0, midX, hPx, famille.subtitle);
    this.drawBranding(ctx, logo, settings.weddingDate, midX, 0, wPx - midX, hPx);

    return canvas;
  }

  private async drawAvatars(
    ctx: CanvasRenderingContext2D,
    personnes: AvatarLabelPerson[],
    x: number,
    y: number,
    w: number,
    h: number,
    subtitle?: string
  ): Promise<void> {
    const list = personnes.length > 0 ? personnes : [{ prenom: '?', nom: '', imageSrc: AVATAR_PLACEHOLDER_SRC }];
    const count = list.length;
    const cols = count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const pad = w * 0.08;
    const cellW = (w - pad * 2) / cols;
    const cellH = (h - pad * 2) / rows;
    const avatarSize = Math.min(cellW, cellH) * 0.72;

    const images = await Promise.all(list.map((p) => this.loadImage(p.imageSrc)));

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + pad + cellW * col + cellW / 2;
      const cy = y + pad + cellH * row + cellH / 2 - h * 0.04;
      this.drawCircularAvatar(ctx, images[i], cx, cy, avatarSize / 2);

      const name = `${list[i].prenom} ${list[i].nom}`.trim();
      if (name) {
        ctx.fillStyle = '#3d2f36';
        ctx.font = `600 ${Math.max(10, avatarSize * 0.16)}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(name, cx, cy + avatarSize / 2 + avatarSize * 0.06, cellW * 0.95);
      }
      if (count === 1 && subtitle?.trim()) {
        ctx.fillStyle = 'rgba(92, 74, 82, 0.85)';
        ctx.font = `italic ${Math.max(8, avatarSize * 0.12)}px Georgia, "Times New Roman", serif`;
        ctx.fillText(subtitle.trim(), cx, cy + avatarSize / 2 + avatarSize * 0.22, cellW * 0.95);
      }
    }
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

    ctx.strokeStyle = 'rgba(184, 150, 90, 0.85)';
    ctx.lineWidth = Math.max(1.5, radius * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawBranding(
    ctx: CanvasRenderingContext2D,
    logo: HTMLImageElement,
    weddingDate: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const cx = x + w / 2;
    const panelW = w * 0.78;
    const panelH = h * 0.88;
    const panelX = cx - panelW / 2;
    const panelY = y + (h - panelH) / 2;
    const radius = h * 0.06;

    const grad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    grad.addColorStop(0, '#3d5248');
    grad.addColorStop(0.5, '#4a6358');
    grad.addColorStop(1, '#5a7568');
    ctx.fillStyle = grad;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(214, 188, 130, 0.55)';
    ctx.lineWidth = Math.max(1, w * 0.008);
    this.roundRect(ctx, panelX, panelY, panelW, panelH, radius);
    ctx.stroke();

    const logoMaxW = panelW * 0.72;
    const logoMaxH = panelH * 0.38;
    const logoScale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height);
    const logoW = logo.width * logoScale;
    const logoH = logo.height * logoScale;
    const logoY = panelY + panelH * 0.14;

    ctx.drawImage(logo, cx - logoW / 2, logoY, logoW, logoH);

    const ruleY = logoY + logoH + panelH * 0.07;
    ctx.strokeStyle = 'rgba(214, 188, 130, 0.75)';
    ctx.lineWidth = Math.max(1, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(cx - panelW * 0.28, ruleY);
    ctx.lineTo(cx + panelW * 0.28, ruleY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(250, 246, 241, 0.95)';
    ctx.font = `italic ${Math.max(11, h * 0.085)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(weddingDate, cx, ruleY + panelH * 0.06, panelW * 0.9);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
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
