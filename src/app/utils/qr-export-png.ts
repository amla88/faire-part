/**
 * QR pour export / InDesign : couleur des modules fixée (charte), fond transparent.
 * R=72, V=73, B=76 → #48494c
 */

export const QR_INDESIGN_MODULE_RGB = { r: 72, g: 73, b: 76 } as const;

/** Format RRGGBBAA (angularx-qrcode, lib qrcode) */
export const QR_MODULE_COLOR_DARK_HEX = '#48494cff';

export const QR_MODULE_COLOR_LIGHT_HEX = '#00000000';

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(source, 0, 0);
  return c;
}

/** PNG fidèle au canvas (clone pour ne pas toucher l’affichage). */
export function qrCanvasToDownloadablePngDataUrl(source: HTMLCanvasElement): string {
  return cloneCanvas(source).toDataURL('image/png');
}
