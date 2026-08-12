import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AvatarLabelFamille,
  AvatarLabelPerson,
  AvatarLabelSettings,
  DEFAULT_LABEL_BACKGROUND,
  WEDDING_LOGO_SRC,
} from './avatar-label-export.types';
import { AVATAR_PLACEHOLDER_SRC } from './admin-avatars.utils';

const EXPORT_DPI = 300;

@Injectable({ providedIn: 'root' })
export class AvatarLabelExportService {
  async exportPdf(famille: AvatarLabelFamille, settings: AvatarLabelSettings): Promise<void> {
    const canvas = await this.renderLabelCanvas(famille, settings);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({
      unit: 'mm',
      format: [settings.widthMm, settings.heightMm],
      orientation: settings.widthMm >= settings.heightMm ? 'landscape' : 'portrait',
      compress: true,
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, settings.widthMm, settings.heightMm);
    const slug = this.fileSlug(famille.displayName);
    pdf.save(`etiquette-${slug}.pdf`);
  }

  async exportPng(famille: AvatarLabelFamille, settings: AvatarLabelSettings): Promise<void> {
    const canvas = await this.renderLabelCanvas(famille, settings);
    const slug = this.fileSlug(famille.displayName);
    this.downloadDataUrl(canvas.toDataURL('image/png'), `etiquette-${slug}.png`);
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
    settings: AvatarLabelSettings
  ): Promise<HTMLCanvasElement> {
    const wPx = this.mmToPx(settings.widthMm);
    const hPx = this.mmToPx(settings.heightMm);
    const canvas = document.createElement('canvas');
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');

    const bgSrc = settings.backgroundDataUrl ?? DEFAULT_LABEL_BACKGROUND;
    const [bg, logo] = await Promise.all([
      this.loadImage(bgSrc),
      this.loadImage(WEDDING_LOGO_SRC),
    ]);

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

    await this.drawAvatars(ctx, famille.personnes, 0, 0, midX, hPx);
    this.drawBranding(ctx, logo, settings.weddingDate, midX, 0, wPx - midX, hPx);

    return canvas;
  }

  private async drawAvatars(
    ctx: CanvasRenderingContext2D,
    personnes: AvatarLabelPerson[],
    x: number,
    y: number,
    w: number,
    h: number
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
