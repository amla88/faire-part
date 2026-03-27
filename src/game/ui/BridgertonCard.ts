import Phaser from 'phaser';

export interface CardStyle {
  fillTop: number;
  fillBottom: number;
  fillAlpha: number;
  borderColor: number;
  borderAlpha: number;
  radius: number;
  shadowColor: number;
  shadowAlpha: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export const bridgertonCardStyle: CardStyle = {
  fillTop: 0xffffff,
  fillBottom: 0xfaf6f1, // --bridgerton-cream
  fillAlpha: 0.96,
  borderColor: 0xb8956a, // --bridgerton-gold (border soft look)
  borderAlpha: 0.28,
  radius: 6,
  shadowColor: 0x2c2433, // --bridgerton-ink
  shadowAlpha: 0.12,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
};

export function drawCardGraphics(
  shadow: Phaser.GameObjects.Graphics,
  card: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CardStyle = bridgertonCardStyle
): void {
  shadow.clear();
  shadow.fillStyle(style.shadowColor, style.shadowAlpha);
  shadow.fillRoundedRect(
    x - w / 2 + style.shadowOffsetX,
    y - h / 2 + style.shadowOffsetY,
    w,
    h,
    style.radius
  );

  card.clear();
  card.fillStyle(style.fillBottom, style.fillAlpha);
  card.fillRoundedRect(x - w / 2, y - h / 2, w, h, style.radius);
  card.fillStyle(style.fillTop, style.fillAlpha * 0.35);
  card.fillRoundedRect(x - w / 2, y - h / 2, w, Math.floor(h * 0.45), style.radius);

  card.lineStyle(1, style.borderColor, style.borderAlpha);
  card.strokeRoundedRect(x - w / 2, y - h / 2, w, h, style.radius);

  card.lineStyle(1, 0xffffff, 0.18);
  card.strokeRoundedRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2, Math.max(2, style.radius - 2));
}

/** Simple "card" look: rounded rect + subtle shadow. */
export function createCardGraphics(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CardStyle = bridgertonCardStyle
): { shadow: Phaser.GameObjects.Graphics; card: Phaser.GameObjects.Graphics } {
  const shadow = scene.add.graphics();
  const card = scene.add.graphics();
  drawCardGraphics(shadow, card, x, y, w, h, style);

  return { shadow, card };
}

