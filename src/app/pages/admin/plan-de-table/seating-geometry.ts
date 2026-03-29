/** Épaisseur du mur périphérique dessiné à l’extérieur de la pièce (cm), purement visuel. */
export const SEATING_PERIMETER_WALL_CM = 20;

/** Arrondit `value` au multiple entier le plus proche de `stepCm` (cm). */
export function snapCm(value: number, stepCm: number): number {
  const step = Math.max(1, Math.min(50_000, Math.round(stepCm)));
  return Math.round(value / step) * step;
}

const DEG2RAD = Math.PI / 180;

/** Chaises autour d’une table ronde : cercle à diamètre/2 + marge. */
function chairsRound(cx: number, cy: number, diameterCm: number, n: number, outwardCm: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  const r = diameterCm / 2 + outwardCm;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** Chaises autour d’une ellipse (ovale), échantillonnage angulaire. */
function chairsOval(cx: number, cy: number, w: number, d: number, rotDeg: number, n: number, outwardCm: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  const rx = w / 2 + outwardCm;
  const ry = d / 2 + outwardCm;
  const rad = rotDeg * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n - Math.PI / 2;
    const lx = rx * Math.cos(t);
    const ly = ry * Math.sin(t);
    out.push({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });
  }
  return out;
}

function rectPerimeterChairs(
  cx: number,
  cy: number,
  hw: number,
  hd: number,
  rotDeg: number,
  n: number,
  outwardCm: number,
): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  const segLens = [2 * hw, 2 * hd, 2 * hw, 2 * hd];
  const perim = segLens.reduce((a, b) => a + b, 0);
  const normals = [
    { nx: 0, ny: -1 },
    { nx: 1, ny: 0 },
    { nx: 0, ny: 1 },
    { nx: -1, ny: 0 },
  ];
  const step = perim / n;
  const rad = rotDeg * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    let s = i * step;
    let si = 0;
    while (si < 4 && s >= segLens[si]) {
      s -= segLens[si];
      si++;
    }
    const p0 = corners[si];
    const p1 = corners[(si + 1) % 4];
    const L = segLens[si];
    const t = L > 0 ? s / L : 0;
    const lx = p0.x + (p1.x - p0.x) * t + normals[si].nx * outwardCm;
    const ly = p0.y + (p1.y - p0.y) * t + normals[si].ny * outwardCm;
    out.push({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });
  }
  return out;
}

/** width_cm = diamètre des demi-cercles ; depth_cm = longueur de la partie rectangulaire centrale (axe long). */
function capsulePerimeterChairs(
  cx: number,
  cy: number,
  widthCm: number,
  depthCm: number,
  rotDeg: number,
  n: number,
  outwardCm: number,
): { x: number; y: number }[] {
  if (n <= 0) return [];
  const r = widthCm / 2;
  const hx = depthCm / 2;
  const arcLen = Math.PI * r;
  const straightLen = depthCm;
  const perim = 2 * straightLen + 2 * arcLen;
  if (perim < 1) return [];
  const step = perim / n;
  const rad = rotDeg * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localAt = (s: number): { lx: number; ly: number; nx: number; ny: number } => {
    let u = ((s % perim) + perim) % perim;
    if (u < straightLen) {
      const t = straightLen > 0 ? u / straightLen : 0;
      const lx = -hx + t * (2 * hx);
      const ly = -r;
      return { lx, ly, nx: 0, ny: -1 };
    }
    u -= straightLen;
    if (u < arcLen) {
      const ang = -Math.PI / 2 + (arcLen > 0 ? (u / arcLen) * Math.PI : 0);
      const lx = hx + r * Math.cos(ang);
      const ly = r * Math.sin(ang);
      return { lx, ly, nx: Math.cos(ang), ny: Math.sin(ang) };
    }
    u -= arcLen;
    if (u < straightLen) {
      const t = straightLen > 0 ? u / straightLen : 0;
      const lx = hx - t * (2 * hx);
      const ly = r;
      return { lx, ly, nx: 0, ny: 1 };
    }
    u -= straightLen;
    const ang = Math.PI / 2 + (arcLen > 0 ? (u / arcLen) * Math.PI : 0);
    const lx = -hx + r * Math.cos(ang);
    const ly = r * Math.sin(ang);
    return { lx, ly, nx: Math.cos(ang), ny: Math.sin(ang) };
  };

  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * step;
    const { lx, ly, nx, ny } = localAt(s);
    const ox = lx + nx * outwardCm;
    const oy = ly + ny * outwardCm;
    out.push({
      x: cx + ox * cos - oy * sin,
      y: cy + ox * sin + oy * cos,
    });
  }
  return out;
}

export type SeatingTableShapeKind = 'round' | 'rect' | 'oval' | 'capsule';

/** Path SVG (repère table, y vers le bas) : rectangle central + demi-cercles, diamètre = largeur. */
export function capsuleTablePathD(widthCm: number, depthCm: number): string {
  const r = widthCm / 2;
  const hx = depthCm / 2;
  if (r <= 0) return '';
  return `M ${-hx} ${-r} L ${hx} ${-r} A ${r} ${r} 0 0 1 ${hx} ${r} L ${-hx} ${r} A ${r} ${r} 0 0 1 ${-hx} ${-r} Z`;
}

export function chairPositionsForTable(
  shape: SeatingTableShapeKind,
  centerX: number,
  centerY: number,
  widthCm: number,
  depthCm: number,
  rotationDeg: number,
  count: number,
  outwardCm = 38,
): { x: number; y: number }[] {
  if (count <= 0) return [];
  switch (shape) {
    case 'round':
      return chairsRound(centerX, centerY, widthCm, count, outwardCm);
    case 'oval':
      return chairsOval(centerX, centerY, widthCm, depthCm, rotationDeg, count, outwardCm);
    case 'rect':
      return rectPerimeterChairs(centerX, centerY, widthCm / 2, depthCm / 2, rotationDeg, count, outwardCm);
    case 'capsule':
      return capsulePerimeterChairs(centerX, centerY, widthCm, depthCm, rotationDeg, count, outwardCm);
    default:
      return [];
  }
}

/** Capsule : bande autour du segment central d’axe x, rayon width_cm/2. */
function pointInCapsuleLocal(lx: number, ly: number, widthCm: number, depthCm: number): boolean {
  const r = widthCm / 2;
  const hx = depthCm / 2;
  if (r <= 0) return false;
  const tx = Math.max(-hx, Math.min(hx, lx));
  const dx = lx - tx;
  const dy = ly;
  return dx * dx + dy * dy <= r * r;
}

export function pointInTable(
  px: number,
  py: number,
  shape: SeatingTableShapeKind,
  cx: number,
  cy: number,
  widthCm: number,
  depthCm: number,
  rotationDeg: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const rad = -rotationDeg * DEG2RAD;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  const hw = widthCm / 2;
  const hd = depthCm / 2;

  switch (shape) {
    case 'round':
      return lx * lx + ly * ly <= hw * hw;
    case 'rect':
      return Math.abs(lx) <= hw && Math.abs(ly) <= hd;
    case 'oval':
      if (hw <= 0 || hd <= 0) return false;
      return (lx * lx) / (hw * hw) + (ly * ly) / (hd * hd) <= 1;
    case 'capsule':
      return pointInCapsuleLocal(lx, ly, widthCm, depthCm);
    default:
      return false;
  }
}

export function findTableAtPoint(
  px: number,
  py: number,
  tables: { id: number; shape: SeatingTableShapeKind; center_x_cm: number; center_y_cm: number; width_cm: number; depth_cm: number; rotation_deg: number }[],
): number | null {
  for (let i = tables.length - 1; i >= 0; i--) {
    const t = tables[i];
    if (pointInTable(px, py, t.shape, t.center_x_cm, t.center_y_cm, t.width_cm, t.depth_cm, t.rotation_deg)) {
      return t.id;
    }
  }
  return null;
}

export type PerimeterEdge = 'north' | 'east' | 'south' | 'west';

/** Cible mur : segment intérieur, ou axe médian du mur extérieur (mi-épaisseur hors pièce). */
export type SeatingWallHitTarget =
  | {
      kind: 'segment';
      wallSegmentId: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      lengthCm: number;
      thickness_cm: number;
    }
  | {
      kind: 'perimeter';
      edge: PerimeterEdge;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      lengthCm: number;
      thickness_cm: number;
    };

export interface SeatingWallHitResult {
  target: SeatingWallHitTarget;
  /** Distance du clic au segment (cm). */
  distanceCm: number;
  /** Abscisse curviligne du projeté orthogonal sur le segment, depuis (x1,y1), dans [0, lengthCm]. */
  alongCm: number;
}

function segmentLength(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Distance point → segment fini, et abscisse du projeté depuis (x1,y1). */
export function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { dist: number; alongCm: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  if (L2 < 1e-12) return { dist: Math.hypot(px - x1, py - y1), alongCm: 0 };
  let t = ((px - x1) * dx + (py - y1) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const L = Math.sqrt(L2);
  return { dist: Math.hypot(px - qx, py - qy), alongCm: t * L };
}

function wallStrokeCm(w: { thickness_cm?: number }): number {
  return w.thickness_cm ?? 4;
}

/**
 * Axe médian des murs extérieurs (repère plan cm, y vers le bas).
 * Le bandeau visuel s’étend de 0 à ±épaisseur hors rectangle pièce ; les fenêtres
 * s’alignent sur la ligne à mi-épaisseur, pas sur le bord intérieur de la dalle.
 */
export function perimeterWallTargets(roomWidthCm: number, roomHeightCm: number, perimeterThicknessCm: number): SeatingWallHitTarget[] {
  const rw = roomWidthCm;
  const rh = roomHeightCm;
  const h = perimeterThicknessCm / 2;
  return [
    { kind: 'perimeter', edge: 'north', x1: 0, y1: -h, x2: rw, y2: -h, lengthCm: rw, thickness_cm: perimeterThicknessCm },
    { kind: 'perimeter', edge: 'east', x1: rw + h, y1: 0, x2: rw + h, y2: rh, lengthCm: rh, thickness_cm: perimeterThicknessCm },
    { kind: 'perimeter', edge: 'south', x1: rw, y1: rh + h, x2: 0, y2: rh + h, lengthCm: rw, thickness_cm: perimeterThicknessCm },
    { kind: 'perimeter', edge: 'west', x1: -h, y1: rh, x2: -h, y2: 0, lengthCm: rh, thickness_cm: perimeterThicknessCm },
  ];
}

/** Mur le plus proche du clic si distance ≤ maxDistCm. */
export function findClosestWallHit(
  px: number,
  py: number,
  segments: { id: number; x1_cm: number; y1_cm: number; x2_cm: number; y2_cm: number; thickness_cm?: number }[],
  roomWidthCm: number,
  roomHeightCm: number,
  perimeterThicknessCm: number,
  maxDistCm: number,
): SeatingWallHitResult | null {
  let best: SeatingWallHitResult | null = null;
  for (const s of segments) {
    const { dist, alongCm } = distancePointToSegment(px, py, s.x1_cm, s.y1_cm, s.x2_cm, s.y2_cm);
    if (dist > maxDistCm) continue;
    if (!best || dist < best.distanceCm) {
      const L = segmentLength(s.x1_cm, s.y1_cm, s.x2_cm, s.y2_cm);
      best = {
        target: {
          kind: 'segment',
          wallSegmentId: s.id,
          x1: s.x1_cm,
          y1: s.y1_cm,
          x2: s.x2_cm,
          y2: s.y2_cm,
          lengthCm: L,
          thickness_cm: wallStrokeCm(s),
        },
        distanceCm: dist,
        alongCm,
      };
    }
  }
  for (const t of perimeterWallTargets(roomWidthCm, roomHeightCm, perimeterThicknessCm)) {
    const { dist, alongCm } = distancePointToSegment(px, py, t.x1, t.y1, t.x2, t.y2);
    if (dist > maxDistCm) continue;
    if (!best || dist < best.distanceCm) {
      best = { target: t, distanceCm: dist, alongCm };
    }
  }
  return best;
}

/** Centre d’une fenêtre le long du mur : clamp pour que [center ± width/2] ⊆ [0, L]. */
export function clampWindowCenterAlong(alongCm: number, widthCm: number, lengthCm: number): number | null {
  if (lengthCm < 1 || widthCm > lengthCm) return null;
  const half = widthCm / 2;
  const minC = half;
  const maxC = lengthCm - half;
  return Math.max(minC, Math.min(maxC, alongCm));
}

export interface SeatingWindowPlaced {
  wall_segment_id: number | null;
  perimeter_edge: PerimeterEdge | null;
  offset_along_cm: number;
  width_cm: number;
  thickness_cm: number;
}

/** Extrémités du trait fenêtre en plan (cm). */
export function windowOpeningEndpoints(
  w: {
    wall_segment_id: number | null;
    perimeter_edge: PerimeterEdge | null;
    offset_along_cm: number;
    width_cm: number;
  },
  walls: { id: number; x1_cm: number; y1_cm: number; x2_cm: number; y2_cm: number }[],
  roomWidthCm: number,
  roomHeightCm: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const half = w.width_cm / 2;
  let x1s: number;
  let y1s: number;
  let x2s: number;
  let y2s: number;
  let L: number;

  if (w.wall_segment_id != null) {
    const seg = walls.find((s) => s.id === w.wall_segment_id);
    if (!seg) return null;
    x1s = seg.x1_cm;
    y1s = seg.y1_cm;
    x2s = seg.x2_cm;
    y2s = seg.y2_cm;
    L = segmentLength(x1s, y1s, x2s, y2s);
  } else if (w.perimeter_edge) {
    const targets = perimeterWallTargets(roomWidthCm, roomHeightCm, SEATING_PERIMETER_WALL_CM);
    const t = targets.find((e) => e.kind === 'perimeter' && e.edge === w.perimeter_edge);
    if (!t) return null;
    x1s = t.x1;
    y1s = t.y1;
    x2s = t.x2;
    y2s = t.y2;
    L = t.lengthCm;
  } else {
    return null;
  }

  if (L < 1) return null;
  const ux = (x2s - x1s) / L;
  const uy = (y2s - y1s) / L;
  const c0 = w.offset_along_cm - half;
  const c1 = w.offset_along_cm + half;
  return {
    x1: x1s + ux * c0,
    y1: y1s + uy * c0,
    x2: x1s + ux * c1,
    y2: y1s + uy * c1,
  };
}

export type SeatingDoorKind = 'single' | 'double' | 'opening';

/** Élément de dessin 2D (plan type architecte). */
export interface DoorPlanElement {
  d: string;
  cssClass: string;
  /** Épaisseur de trait en unités SVG (cm). */
  strokeWidth: number;
}

/** Normale unitaire « vers l’intérieur de la pièce » (côté battant par défaut). */
export function doorOpeningInwardNormal(
  perimeterEdge: PerimeterEdge | null,
  midX: number,
  midY: number,
  tx: number,
  ty: number,
  roomW: number,
  roomH: number,
): { nx: number; ny: number } {
  if (perimeterEdge === 'north') return { nx: 0, ny: 1 };
  if (perimeterEdge === 'south') return { nx: 0, ny: -1 };
  if (perimeterEdge === 'east') return { nx: -1, ny: 0 };
  if (perimeterEdge === 'west') return { nx: 1, ny: 0 };
  const cx = roomW / 2;
  const cy = roomH / 2;
  const perpLx = -ty;
  const perpLy = tx;
  const perpRx = ty;
  const perpRy = -tx;
  const dotL = perpLx * (cx - midX) + perpLy * (cy - midY);
  const dotR = perpRx * (cx - midX) + perpRy * (cy - midY);
  if (dotL >= dotR) return { nx: perpLx, ny: perpLy };
  return { nx: perpRx, ny: perpRy };
}

/** Côté d’ouverture : même demi-plan que le pointeur par rapport à la normale canonique. */
export function doorSwingSignTowardPointer(
  pointerX: number,
  pointerY: number,
  midX: number,
  midY: number,
  canonNx: number,
  canonNy: number,
): 1 | -1 {
  const dot = (pointerX - midX) * canonNx + (pointerY - midY) * canonNy;
  return dot >= 0 ? 1 : -1;
}

/** Sweep-flag SVG (0|1) pour un arc centre → début → fin, repère y vers le bas. */
function svgArcSweep(cx: number, cy: number, sx: number, sy: number, ex: number, ey: number): 0 | 1 {
  const cross = (sx - cx) * (ey - cy) - (sy - cy) * (ex - cx);
  return cross >= 0 ? 1 : 0;
}

/** z du produit t × n (repère y vers le bas). Détermine quel montant est « charnière » pour un quart de cercle correct. */
function crossTangentNormal(tx: number, ty: number, nx: number, ny: number): number {
  return tx * ny - ty * nx;
}

/**
 * Symboles plan : seuil, arcs de battant(s) façon DA, ou simple ouverture avec traits de feuillure.
 */
export function doorPlanGraphics(
  doorKind: SeatingDoorKind,
  endpoints: { x1: number; y1: number; x2: number; y2: number },
  thicknessCm: number,
  perimeterEdge: PerimeterEdge | null,
  roomWidthCm: number,
  roomHeightCm: number,
  /** +1 = côté normale « pièce » ; -1 = côté opposé (couloir, etc.). */
  swingSign: 1 | -1 = 1,
): DoorPlanElement[] {
  const Sx = endpoints.x1;
  const Sy = endpoints.y1;
  const Ex = endpoints.x2;
  const Ey = endpoints.y2;
  const w = Math.hypot(Ex - Sx, Ey - Sy);
  if (w < 1) return [];
  const tx = (Ex - Sx) / w;
  const ty = (Ey - Sy) / w;
  const midX = (Sx + Ex) / 2;
  const midY = (Sy + Ey) / 2;
  const { nx: n0x, ny: n0y } = doorOpeningInwardNormal(perimeterEdge, midX, midY, tx, ty, roomWidthCm, roomHeightCm);
  const nx = doorKind === 'opening' ? n0x : n0x * swingSign;
  const ny = doorKind === 'opening' ? n0y : n0y * swingSign;

  const out: DoorPlanElement[] = [];
  const swTh = Math.max(0.9, Math.min(8, thicknessCm * 0.28));
  const swArc = Math.max(0.65, Math.min(6, thicknessCm * 0.2));
  const swJamb = Math.max(0.55, Math.min(5, thicknessCm * 0.18));
  const tLine = Math.max(0.35, Math.min(5, thicknessCm * 0.1));

  out.push({ d: `M ${Sx} ${Sy} L ${Ex} ${Ey}`, cssClass: 'door-threshold', strokeWidth: swTh });

  if (doorKind === 'opening') {
    const jLen = Math.min(thicknessCm * 0.55, w * 0.12, 22);
    out.push({
      d: `M ${Sx - nx * tLine} ${Sy - ny * tLine} l ${nx * jLen} ${ny * jLen}`,
      cssClass: 'door-jamb',
      strokeWidth: swJamb,
    });
    out.push({
      d: `M ${Ex - nx * tLine} ${Ey - ny * tLine} l ${nx * jLen} ${ny * jLen}`,
      cssClass: 'door-jamb',
      strokeWidth: swJamb,
    });
    return out;
  }

  if (doorKind === 'single') {
    const r = w;
    const cz = crossTangentNormal(tx, ty, nx, ny);
    let Hx: number;
    let Hy: number;
    let Ax: number;
    let Ay: number;
    if (cz > 0) {
      Hx = Sx;
      Hy = Sy;
      Ax = Ex;
      Ay = Ey;
    } else {
      Hx = Ex;
      Hy = Ey;
      Ax = Sx;
      Ay = Sy;
    }
    const Px = Hx + r * nx;
    const Py = Hy + r * ny;
    const sweep = svgArcSweep(Hx, Hy, Ax, Ay, Px, Py);
    const swLeaf = Math.max(0.55, swArc * 0.9);
    out.push({
      d: `M ${Ax} ${Ay} A ${r} ${r} 0 0 ${sweep} ${Px} ${Py}`,
      cssClass: 'door-swing-arc',
      strokeWidth: swArc,
    });
    out.push({
      d: `M ${Hx} ${Hy} L ${Px} ${Py}`,
      cssClass: 'door-leaf',
      strokeWidth: swLeaf,
    });
    return out;
  }

  /* Double battant : charnières aux montants S et E (pas au milieu). Chaque arc va du milieu du seuil M
   * vers l’extrémité ouverte du demi-battant, centre au montant, rayon w/2 (quart de cercle). */
  const w2 = w / 2;
  const Mx = Sx + w2 * tx;
  const My = Sy + w2 * ty;
  const Px = Sx + w2 * nx;
  const Py = Sy + w2 * ny;
  const Qx = Ex + w2 * nx;
  const Qy = Ey + w2 * ny;
  const sweepL = svgArcSweep(Sx, Sy, Mx, My, Px, Py);
  const sweepR = svgArcSweep(Ex, Ey, Mx, My, Qx, Qy);
  const swLeafD = Math.max(0.55, swArc * 0.9);
  out.push({
    d: `M ${Mx} ${My} A ${w2} ${w2} 0 0 ${sweepL} ${Px} ${Py}`,
    cssClass: 'door-swing-arc',
    strokeWidth: swArc,
  });
  out.push({
    d: `M ${Mx} ${My} A ${w2} ${w2} 0 0 ${sweepR} ${Qx} ${Qy}`,
    cssClass: 'door-swing-arc',
    strokeWidth: swArc,
  });
  out.push({
    d: `M ${Sx} ${Sy} L ${Px} ${Py}`,
    cssClass: 'door-leaf',
    strokeWidth: swLeafD,
  });
  out.push({
    d: `M ${Ex} ${Ey} L ${Qx} ${Qy}`,
    cssClass: 'door-leaf',
    strokeWidth: swLeafD,
  });
  return out;
}
