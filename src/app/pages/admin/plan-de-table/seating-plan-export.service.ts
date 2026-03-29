import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  PersonneRepasRow,
  SeatingAssignment,
  SeatingTable,
  SeatingVenue,
} from 'src/app/services/seating-plan.service';
import { chairPositionsForTable, seatingCanvasOuterSizeCm } from './seating-geometry';

/**
 * Données figées pour un export PNG/PDF (évite de coupler le service au composant).
 * `assignmentsByTable` : même structure que dans l’admin (liste triée par seat_order par table).
 */
export interface SeatingExportSnapshot {
  venue: SeatingVenue;
  tables: SeatingTable[];
  assignmentsByTable: Map<number, SeatingAssignment[]>;
  personneById: Map<number, PersonneRepasRow>;
  displayPersonne: (p: PersonneRepasRow) => string;
  variantName: string;
}

/** Options de rasterisation (ex. macarons initiales seulement pour le PDF). */
export interface RasterizePlanOptions {
  macaronInitialsOnly?: boolean;
  /**
   * Réduit le bitmap pour la 1ʳᵉ page PDF : résolution cible (~dpi) par rapport à la zone dessinée
   * en A4 paysage (évite les centaines de Mo). Utilise JPEG pour le plan dans le PDF.
   */
  pdfPageRaster?: {
    /** Défaut 300 (impression courante). */
    targetDpi?: number;
    /** Qualité JPEG 0–1, défaut 0.88. */
    jpegQuality?: number;
  };
}

/**
 * Le clone SVG est rendu via blob → Image : les styles encapsulés du composant ne s’appliquent pas.
 * Palette jardin de régence : sauge, lin rosé, glycine, boiseries brume.
 */
const EXPORT_SVG_STYLES = `
  .outer-wall-ring { fill: #6e6272; }
  .table-shape { fill: rgba(228, 236, 222, 0.88); stroke: #8a7a6e; stroke-width: 1.5px; }
  .table-label { font-size: 20px; font-weight: 600; fill: #3a322f; }
  .chair-dot { fill: #fff9f6; stroke: #c4a574; stroke-width: 2px; }
  .chair-initials { font-size: 14px; font-weight: 600; fill: #3a322f; }
  .wall-line { fill: none; stroke: #8a7e74; }
  .window-opening { fill: none; stroke: #9ab8c4; opacity: 0.96; }
  .door-plan .door-threshold { fill: none; stroke: #7a9aaa; stroke-linecap: butt; }
  .door-plan .door-swing-arc, .door-plan .door-leaf { fill: none; stroke: #5c7a8c; stroke-linecap: round; stroke-linejoin: round; }
  .door-plan .door-jamb { fill: none; stroke: #5c7a8c; stroke-linecap: round; stroke-linejoin: round; }
  .freeform-polygon { stroke: #8a7e74; fill: rgba(138, 126, 116, 0.07); stroke-linejoin: round; stroke-linecap: round; }
  .measure-hud-label { fill: #4a3c3a; font-family: Georgia, 'Times New Roman', serif; }
`;

/** Résolution raster (px par cm du plan) pour l’export PNG autonome. */
const EXPORT_PX_PER_CM = 3;

/** A4 paysage (mm) — aligné sur `buildPdfDocument` page 1. */
const PDF_A4_LANDSCAPE_W_MM = 297;
const PDF_A4_LANDSCAPE_H_MM = 210;
const PDF_PLAN_MARGIN_MM = 12;
/** Même retrait que `maxW - 6` / `maxH - 6` dans buildPdfDocument. */
const PDF_PLAN_INNER_PAD_MM = 6;

const MM_PER_INCH = 25.4;
const PDF_PLAN_DEFAULT_DPI = 300;
const PDF_PLAN_DEFAULT_JPEG_QUALITY = 0.88;

/** Fond derrière le plan rasterisé (PDF : blanc). */
const EXPORT_CANVAS_BG = '#ffffff';

/** Couleurs PDF (RGB 0–255) : régence fleurie, sauge et rose thé. */
const PDF_THEME = {
  /** Fond de page PDF (blanc, sans teinte parchemin). */
  paper: [255, 255, 255] as [number, number, number],
  ink: [58, 44, 42] as [number, number, number],
  inkSoft: [98, 82, 78] as [number, number, number],
  powderBlue: [108, 132, 148] as [number, number, number],
  wisteria: [150, 132, 168] as [number, number, number],
  dustyRose: [178, 128, 142] as [number, number, number],
  blushPetal: [236, 210, 216] as [number, number, number],
  sagePetal: [206, 218, 198] as [number, number, number],
  sageLine: [176, 192, 168] as [number, number, number],
  gold: [176, 138, 72] as [number, number, number],
  goldMuted: [210, 188, 140] as [number, number, number],
  goldDeep: [148, 118, 68] as [number, number, number],
  /** Cœur des rosettes. */
  rosetteHeart: [200, 160, 118] as [number, number, number],
};

@Injectable({ providedIn: 'root' })
export class SeatingPlanExportService {
  /**
   * Zone max (mm) où le plan est dessiné sur la 1ʳᵉ page PDF A4 paysage (même logique que buildPdfDocument).
   */
  private pdfPlanMaxDrawMm(): { drawW: number; drawH: number } {
    const maxW = PDF_A4_LANDSCAPE_W_MM - 2 * PDF_PLAN_MARGIN_MM;
    const maxH = PDF_A4_LANDSCAPE_H_MM - 2 * PDF_PLAN_MARGIN_MM;
    return {
      drawW: maxW - PDF_PLAN_INNER_PAD_MM,
      drawH: maxH - PDF_PLAN_INNER_PAD_MM,
    };
  }

  /**
   * Taille en pixels pour ne pas dépasser ~`dpi` sur la zone d’impression PDF (évite sur-échantillonnage).
   */
  private capRasterPixelsForPdfPage(widthCm: number, heightCm: number, dpi: number): { wPx: number; hPx: number } {
    const { drawW, drawH } = this.pdfPlanMaxDrawMm();
    const maxPxW = Math.max(1, Math.ceil((drawW / MM_PER_INCH) * dpi));
    const maxPxH = Math.max(1, Math.ceil((drawH / MM_PER_INCH) * dpi));
    const aspect = widthCm / heightCm;
    let wPx = maxPxW;
    let hPx = wPx / aspect;
    if (hPx > maxPxH) {
      hPx = maxPxH;
      wPx = hPx * aspect;
    }
    return { wPx: Math.max(1, Math.round(wPx)), hPx: Math.max(1, Math.round(hPx)) };
  }

  /**
   * Prépare le SVG (styles inline, sans overlays d’édition) puis le rasterise.
   * Export PNG : PNG pleine résolution (`EXPORT_PX_PER_CM`). PDF : option `pdfPageRaster` → ~300 dpi sur la page + JPEG.
   */
  async rasterizePlanToPngDataUrl(
    svgEl: SVGSVGElement,
    snapshot: SeatingExportSnapshot,
    options?: RasterizePlanOptions,
  ): Promise<{ dataUrl: string; wPx: number; hPx: number; pdfImageType?: 'PNG' | 'JPEG' } | null> {
    const { widthCm, heightCm } = seatingCanvasOuterSizeCm(snapshot.venue);
    const pdfOpt = options?.pdfPageRaster;
    let w: number;
    let h: number;
    if (pdfOpt != null) {
      const dpi = pdfOpt.targetDpi ?? PDF_PLAN_DEFAULT_DPI;
      const capped = this.capRasterPixelsForPdfPage(widthCm, heightCm, dpi);
      w = capped.wPx;
      h = capped.hPx;
    } else {
      w = Math.round(widthCm * EXPORT_PX_PER_CM);
      h = Math.round(heightCm * EXPORT_PX_PER_CM);
    }
    const clone = this.prepareSvgCloneForExport(svgEl, snapshot, options);
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = EXPORT_CANVAS_BG;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      if (pdfOpt != null) {
        const q = pdfOpt.jpegQuality ?? PDF_PLAN_DEFAULT_JPEG_QUALITY;
        return {
          dataUrl: canvas.toDataURL('image/jpeg', q),
          wPx: w,
          hPx: h,
          pdfImageType: 'JPEG',
        };
      }
      return { dataUrl: canvas.toDataURL('image/png'), wPx: w, hPx: h };
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }

  /**
   * PDF : page 1 = plan en A4 paysage (cadre régence) ; pages suivantes = liste des invités, typo élégante.
   */
  buildPdfDocument(
    raster: { dataUrl: string; wPx: number; hPx: number; pdfImageType?: 'PNG' | 'JPEG' },
    snapshot: SeatingExportSnapshot,
  ): jsPDF {
    const v = snapshot.venue;
    const T = PDF_THEME;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const maxW = pageW - 2 * margin;
    const maxH = pageH - 2 * margin;
    const aspect = raster.wPx / raster.hPx;
    let drawW = maxW - 6;
    let drawH = drawW / aspect;
    if (drawH > maxH - 6) {
      drawH = maxH - 6;
      drawW = drawH * aspect;
    }
    const x0 = margin + (maxW - drawW) / 2;
    const y0 = margin + (maxH - drawH) / 2;

    this.pdfFillPage(pdf, pageW, pageH, T.paper);
    this.pdfDrawLandscapeFrame(pdf, pageW, pageH, margin);
    const imgType = raster.pdfImageType === 'JPEG' ? 'JPEG' : 'PNG';
    pdf.addImage(raster.dataUrl, imgType, x0, y0, drawW, drawH);

    const tablesSorted = [...snapshot.tables].sort(
      (a, b) =>
        (a.label ?? '').localeCompare(b.label ?? '', 'fr', { sensitivity: 'base' }) || a.id - b.id,
    );
    const left = 18;
    const bottomSafe = 26;
    const lineH = 5.4;
    const titleFs = 12.5;
    const bodyFs = 10.5;
    const colGap = 8;

    pdf.addPage('a4', 'portrait');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const textMaxW = pw - 2 * left;
    const contentW = pw - 2 * left;
    const colW = (contentW - colGap) / 2;
    const xColL = left;
    const xColR = left + colW + colGap;
    let y = this.pdfApplyPortraitPage(pdf, pw, ph, left, textMaxW);

    pdf.setFont('times', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(...T.wisteria);
    pdf.text('Réception', pw / 2, y, { align: 'center' });
    y += 6;
    pdf.setTextColor(...T.ink);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(20);
    for (const line of pdf.splitTextToSize(v.name, textMaxW)) {
      if (y > ph - bottomSafe) {
        pdf.addPage('a4', 'portrait');
        y = this.pdfApplyPortraitPage(pdf, pw, ph, left, textMaxW);
      }
      pdf.text(line, pw / 2, y, { align: 'center' });
      y += 8;
    }
    y += 2;
    this.pdfDrawOrnamentalRule(pdf, left, y, pw - left, T.gold);
    y += 8;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(11);
    pdf.setTextColor(...T.inkSoft);
    for (const line of pdf.splitTextToSize(`Disposition : ${snapshot.variantName}`, textMaxW)) {
      if (y > ph - bottomSafe) {
        pdf.addPage('a4', 'portrait');
        y = this.pdfApplyPortraitPage(pdf, pw, ph, left, textMaxW);
      }
      pdf.text(line, pw / 2, y, { align: 'center' });
      y += 5.5;
    }
    pdf.setTextColor(...T.ink);
    y += 6;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...T.dustyRose);
    for (const line of pdf.splitTextToSize('Liste des invités par table', textMaxW)) {
      if (y > ph - bottomSafe) {
        pdf.addPage('a4', 'portrait');
        y = this.pdfApplyPortraitPage(pdf, pw, ph, left, textMaxW);
      }
      pdf.text(line, left, y);
      y += 6.5;
    }
    pdf.setTextColor(...T.ink);
    pdf.setFont('times', 'normal');
    y += 3;

    const bodyStartY = y;
    let yL = bodyStartY;
    let yR = bodyStartY;
    const syncNewPortraitPage = (): number => {
      pdf.addPage('a4', 'portrait');
      const ny = this.pdfApplyPortraitPage(pdf, pw, ph, left, textMaxW);
      yL = ny;
      yR = ny;
      return ny;
    };
    let tableIndex = 0;
    for (const t of tablesSorted) {
      tableIndex += 1;
      const assigns = snapshot.assignmentsByTable.get(t.id) ?? [];
      const byId = snapshot.personneById;
      const guestLabels: string[] = assigns.map((a) => {
        const p = byId.get(a.personne_id);
        return p ? snapshot.displayPersonne(p) : `Personne #${a.personne_id}`;
      });
      const blockH = this.pdfEstimateGuestTableBlockHeight(
        pdf,
        colW,
        tableIndex,
        t,
        guestLabels,
        lineH,
        titleFs,
        bodyFs,
      );

      const limitY = ph - bottomSafe;
      const fitsL = yL + blockH <= limitY;
      const fitsR = yR + blockH <= limitY;

      let x: number;
      let yCol: number;
      if (fitsL) {
        x = xColL;
        yCol = yL;
      } else if (fitsR) {
        x = xColR;
        yCol = yR;
      } else {
        const ny = syncNewPortraitPage();
        yL = yR = ny;
        x = xColL;
        yCol = yL;
      }

      const yAfter = this.pdfDrawGuestTableBlock(
        pdf,
        x,
        yCol,
        colW,
        ph,
        bottomSafe,
        syncNewPortraitPage,
        snapshot,
        T,
        tableIndex,
        t,
        guestLabels,
        lineH,
        titleFs,
        bodyFs,
      );

      if (x === xColL) yL = yAfter;
      else yR = yAfter;
    }

    return pdf;
  }

  /** Hauteur approximative d’un bloc « table + invités » pour placement en colonnes. */
  private pdfEstimateGuestTableBlockHeight(
    pdf: jsPDF,
    colW: number,
    tableIndex: number,
    t: SeatingTable,
    guestLabels: string[],
    lineH: number,
    titleFs: number,
    bodyFs: number,
  ): number {
    const tableTitle = t.label?.trim()
      ? `Table « ${t.label} »`
      : `Table ${tableIndex} (${t.shape})`;
    pdf.setFontSize(titleFs);
    let h = pdf.splitTextToSize(tableTitle, colW).length * (lineH + 0.5);
    h += 5.5;
    pdf.setFontSize(bodyFs);
    if (guestLabels.length === 0) {
      h += lineH + 2;
    } else {
      const textMaxInner = colW - 2;
      for (const label of guestLabels) {
        h += pdf.splitTextToSize(label, textMaxInner).length * lineH;
      }
      h += 5;
    }
    return h + 4;
  }

  /** Dessine une table et ses invités dans une colonne ; gère les sauts de page (réinitialise les deux colonnes). */
  private pdfDrawGuestTableBlock(
    pdf: jsPDF,
    x: number,
    y0: number,
    colW: number,
    ph: number,
    bottomSafe: number,
    syncNewPortraitPage: () => number,
    snapshot: SeatingExportSnapshot,
    T: typeof PDF_THEME,
    tableIndex: number,
    t: SeatingTable,
    guestLabels: string[],
    lineH: number,
    titleFs: number,
    bodyFs: number,
  ): number {
    let y = y0;
    const limitY = ph - bottomSafe;
    const tableTitle = t.label?.trim()
      ? `Table « ${t.label} »`
      : `Table ${tableIndex} (${t.shape})`;
    const textMaxInner = colW - 2;

    const ensureY = (): void => {
      if (y > limitY) {
        y = syncNewPortraitPage();
      }
    };

    pdf.setFont('times', 'bold');
    pdf.setFontSize(titleFs);
    pdf.setTextColor(...T.ink);
    for (const line of pdf.splitTextToSize(tableTitle, colW)) {
      ensureY();
      pdf.text(line, x, y);
      y += lineH + 0.5;
    }
    pdf.setDrawColor(...T.goldMuted);
    pdf.setLineWidth(0.2);
    ensureY();
    pdf.line(x, y, x + Math.min(colW - 1, 48), y);
    y += 5;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(bodyFs);

    if (guestLabels.length === 0) {
      pdf.setFont('times', 'italic');
      pdf.setTextColor(...T.inkSoft);
      ensureY();
      pdf.text('Aucun invité assigné pour l’instant.', x, y);
      y += lineH + 2;
      pdf.setFont('times', 'normal');
      pdf.setTextColor(...T.ink);
    } else {
      for (const label of guestLabels) {
        const wrapped = pdf.splitTextToSize(label, textMaxInner);
        for (let i = 0; i < wrapped.length; i++) {
          ensureY();
          pdf.text(wrapped[i], x, y);
          y += lineH;
        }
      }
      y += 5;
    }
    return y;
  }

  /** Fond pleine page (mm). */
  private pdfFillPage(pdf: jsPDF, w: number, h: number, rgb: [number, number, number]): void {
    pdf.setFillColor(...rgb);
    pdf.rect(0, 0, w, h, 'F');
  }

  /** Double cadre cartouche + rosettes d’angle (paysage). */
  private pdfDrawLandscapeFrame(pdf: jsPDF, pageW: number, pageH: number, margin: number): void {
    const T = PDF_THEME;
    const inset = 4;
    const x1 = margin - inset;
    const y1 = margin - inset;
    const w1 = pageW - 2 * (margin - inset);
    const h1 = pageH - 2 * (margin - inset);
    pdf.setDrawColor(...T.wisteria);
    pdf.setLineWidth(0.12);
    pdf.rect(x1 - 0.6, y1 - 0.6, w1 + 1.2, h1 + 1.2, 'S');
    pdf.setDrawColor(...T.goldDeep);
    pdf.setLineWidth(0.38);
    pdf.rect(x1, y1, w1, h1, 'S');
    pdf.setDrawColor(...T.goldMuted);
    pdf.setLineWidth(0.16);
    pdf.rect(x1 + 2, y1 + 2, w1 - 4, h1 - 4, 'S');
    pdf.setDrawColor(...T.sageLine);
    pdf.setLineWidth(0.1);
    pdf.rect(x1 + 3.3, y1 + 3.3, w1 - 6.6, h1 - 6.6, 'S');
    const rp = 7.5;
    this.pdfDrawRosette(pdf, x1 + rp, y1 + rp, 1.75, T.sagePetal, T.rosetteHeart);
    this.pdfDrawRosette(pdf, x1 + w1 - rp, y1 + rp, 1.75, T.blushPetal, T.rosetteHeart);
    this.pdfDrawRosette(pdf, x1 + rp, y1 + h1 - rp, 1.75, T.blushPetal, T.dustyRose);
    this.pdfDrawRosette(pdf, x1 + w1 - rp, y1 + h1 - rp, 1.75, T.sagePetal, T.powderBlue);
  }

  /** Fond + entête fleurie (filet double, rosette centrale, perles) ; retourne Y du corps. */
  private pdfApplyPortraitPage(
    pdf: jsPDF,
    pw: number,
    ph: number,
    left: number,
    textMaxW: number,
  ): number {
    const T = PDF_THEME;
    this.pdfFillPage(pdf, pw, ph, T.paper);
    const topY = 10.8;
    const mid = pw / 2;
    const wing = 26;
    pdf.setDrawColor(...T.goldDeep);
    pdf.setLineWidth(0.26);
    pdf.line(left, topY, mid - wing, topY);
    pdf.line(mid + wing, topY, pw - left, topY);
    pdf.setDrawColor(...T.goldMuted);
    pdf.setLineWidth(0.11);
    pdf.line(left + 1.2, topY + 0.65, mid - wing, topY + 0.65);
    pdf.line(mid + wing, topY + 0.65, pw - left - 1.2, topY + 0.65);
    this.pdfDrawRosette(pdf, mid, topY, 2.05, T.blushPetal, T.wisteria);
    pdf.setFillColor(...T.sagePetal);
    pdf.circle(left + 6, topY, 0.55, 'F');
    pdf.circle(pw - left - 6, topY, 0.55, 'F');
    pdf.setDrawColor(...T.sageLine);
    pdf.setLineWidth(0.12);
    pdf.line(left + 4, topY + 2.1, pw - left - 4, topY + 2.1);
    const footer = ph - 8;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(...T.powderBlue);
    pdf.text('Avec les compliments des mariés', pw / 2, footer, { align: 'center' });
    pdf.setDrawColor(...T.goldMuted);
    pdf.setLineWidth(0.15);
    pdf.line(left + 12, footer - 3.5, pw - left - 12, footer - 3.5);
    pdf.setTextColor(...T.ink);
    return 24;
  }

  /** Rosette à quatre pétales (cercles) + cœur, style jardin régence. */
  private pdfDrawRosette(
    pdf: jsPDF,
    cx: number,
    cy: number,
    scale: number,
    petalRgb: [number, number, number],
    centerRgb: [number, number, number],
  ): void {
    const r = scale * 0.4;
    const d = scale * 0.5;
    const pts: [number, number][] = [
      [0, -d],
      [d, 0],
      [0, d],
      [-d, 0],
    ];
    pdf.setFillColor(...petalRgb);
    for (const [dx, dy] of pts) {
      pdf.circle(cx + dx, cy + dy, r, 'F');
    }
    pdf.setFillColor(...centerRgb);
    pdf.circle(cx, cy, scale * 0.22, 'F');
  }

  /** Filet brisé, rosette centrale et perles (glycine). */
  private pdfDrawOrnamentalRule(
    pdf: jsPDF,
    x0: number,
    y: number,
    x1: number,
    rgb: [number, number, number],
  ): void {
    const T = PDF_THEME;
    const mid = (x0 + x1) / 2;
    const gap = 9;
    pdf.setDrawColor(...rgb);
    pdf.setLineWidth(0.3);
    pdf.line(x0, y, mid - gap, y);
    pdf.line(mid + gap, y, x1, y);
    pdf.setDrawColor(...T.goldMuted);
    pdf.setLineWidth(0.1);
    pdf.line(x0 + 1.5, y + 0.55, mid - gap, y + 0.55);
    pdf.line(mid + gap, y + 0.55, x1 - 1.5, y + 0.55);
    this.pdfDrawRosette(pdf, mid, y, 2.35, T.sagePetal, T.rosetteHeart);
    const bead = (bx: number) => {
      pdf.setFillColor(...T.wisteria);
      pdf.circle(bx, y, 0.38, 'F');
    };
    bead(x0 + 10);
    bead(x1 - 10);
  }

  private prepareSvgCloneForExport(
    svgEl: SVGSVGElement,
    snapshot: SeatingExportSnapshot,
    options?: RasterizePlanOptions,
  ): SVGSVGElement {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    this.removeSvgExportOverlays(clone);
    this.stripExportInteractionClassesFromSvg(clone);
    this.injectExportStylesIntoSvg(clone);
    this.replaceExportChairMarkersWithGuestNames(
      clone,
      snapshot,
      options?.macaronInitialsOnly === true,
    );
    return clone;
  }

  private injectExportStylesIntoSvg(svg: SVGSVGElement): void {
    const ns = 'http://www.w3.org/2000/svg';
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(ns, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    const styleEl = document.createElementNS(ns, 'style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = EXPORT_SVG_STYLES;
    defs.appendChild(styleEl);
  }

  private removeSvgExportOverlays(svg: SVGSVGElement): void {
    const rm = (sel: string) => {
      svg.querySelectorAll(sel).forEach((el) => el.remove());
    };
    rm('.coord-probe');
    rm('.personne-drag-ghost');
    rm('.freeform-draft');
    rm('.window-placement-preview');
    rm('.door-plan--preview');
    rm('.wall-preview-filigree');
    rm('.measure-line');
    rm('.measure-origin-dot');
    rm('.measure-hud');
    svg.querySelectorAll('circle[stroke="#7b61ff"]').forEach((el) => el.remove());
  }

  private stripExportInteractionClassesFromSvg(svg: SVGSVGElement): void {
    const drop = new Set([
      'table-selected',
      'table-assign-drop--ok',
      'table-assign-drop--bad',
      'wall-line--hover',
      'window-opening--hover',
      'door-plan--hover',
      'freeform-polygon--hover',
    ]);
    for (const el of Array.from(svg.querySelectorAll('[class]'))) {
      const parts = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c: string) => c && !drop.has(c));
      if (parts.length) el.setAttribute('class', parts.join(' '));
      else el.removeAttribute('class');
    }
  }

  private truncateExportGuestLabel(text: string, maxLen: number): string {
    const t = text.trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
  }

  /** Initiales prénom + nom (même logique que l’admin). */
  private personneInitials(p: PersonneRepasRow): string {
    return ((p.prenom?.[0] ?? '') + (p.nom?.[0] ?? '')).toUpperCase();
  }

  private macaronLabelForExport(
    pers: PersonneRepasRow | undefined,
    snapshot: SeatingExportSnapshot,
    initialsOnly: boolean,
  ): string {
    if (!pers) return '';
    if (initialsOnly) {
      const ini = this.personneInitials(pers);
      if (ini) return ini;
      const full = snapshot.displayPersonne(pers).trim();
      return full ? full.charAt(0).toUpperCase() : '?';
    }
    const rawName = snapshot.displayPersonne(pers);
    return rawName ? this.truncateExportGuestLabel(rawName, 18) : '';
  }

  private replaceExportChairMarkersWithGuestNames(
    svg: SVGSVGElement,
    snapshot: SeatingExportSnapshot,
    macaronInitialsOnly: boolean,
  ): void {
    const dots = Array.from(svg.querySelectorAll('circle.chair-dot')).filter(
      (c: Element) => !c.classList.contains('chair-dot--ghost'),
    );
    const groups = new Set<Element>();
    for (const c of dots) {
      const g = c.parentElement;
      if (g && g.tagName.toLowerCase() === 'g') groups.add(g);
    }
    groups.forEach((g) => g.remove());

    const ns = 'http://www.w3.org/2000/svg';
    const byId = snapshot.personneById;
    const rMac = macaronInitialsOnly ? 25 : 22;
    const fontPx = macaronInitialsOnly ? 14.5 : 8.5;

    for (const t of snapshot.tables) {
      const assigns = snapshot.assignmentsByTable.get(t.id) ?? [];
      const n = assigns.length;
      const positions = chairPositionsForTable(
        t.shape,
        t.center_x_cm,
        t.center_y_cm,
        t.width_cm,
        t.depth_cm,
        t.rotation_deg,
        n,
      );
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        const a = assigns[i];
        const pers = a ? byId.get(a.personne_id) : undefined;
        const label = this.macaronLabelForExport(pers, snapshot, macaronInitialsOnly);

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${p.x},${p.y})`);

        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('r', String(rMac));
        circle.setAttribute('fill', '#fff9f6');
        circle.setAttribute('stroke', '#c4a574');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);

        if (label) {
          const text = document.createElementNS(ns, 'text');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('dominant-baseline', 'middle');
          text.setAttribute('fill', '#3d3230');
          text.setAttribute('font-size', String(fontPx));
          text.setAttribute('font-weight', '600');
          text.setAttribute('font-family', "Georgia, 'Times New Roman', Times, serif");
          text.textContent = label;
          g.appendChild(text);
        }

        svg.appendChild(g);
      }
    }
  }
}
