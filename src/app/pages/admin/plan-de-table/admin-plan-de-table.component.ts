import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  PersonneRepasRow,
  SeatingAssignment,
  SeatingLayoutVariant,
  SeatingPlanService,
  SeatingTable,
  SeatingTableShape,
  SeatingVenue,
  SeatingDoor,
  SeatingDoorKind,
  SeatingFreeformPolygon,
  SeatingPerimeterEdge,
  SeatingWallSegment,
  SeatingWindow,
} from 'src/app/services/seating-plan.service';
import {
  capsuleTablePathD,
  chairPositionsForTable,
  clampWindowCenterAlong,
  doorOpeningInwardNormal,
  doorPlanGraphics,
  doorSwingSignTowardPointer,
  findClosestWallHit,
  findTableAtPoint,
  seatingCanvasOuterSizeCm,
  snapCm,
  windowOpeningEndpoints,
  type DoorPlanElement,
  SEATING_PERIMETER_WALL_CM,
} from './seating-geometry';
import {
  SeatingPlanExportService,
  type SeatingExportSnapshot,
} from './seating-plan-export.service';
import { AdminPlanDeTableToolbarComponent } from './admin-plan-de-table-toolbar.component';
import type { PlanMode } from './admin-plan-de-table.types';
import { firstValueFrom } from 'rxjs';
import {
  TableGuestsDialogComponent,
  type TableGuestsFamilleGroup,
  type TableGuestMember,
} from './table-guests-dialog.component';
import { VariantNameDialogComponent } from './variant-name-dialog.component';
import { AdminPlanDeTableCanvasComponent } from './admin-plan-de-table-canvas.component';
import { AdminPlanDeTableSidePanelComponent } from './admin-plan-de-table-side-panel.component';

/**
 * Page admin plan de table : salle unique, variantes de disposition, tables et placements invités.
 * Orchestration du SVG + panneau latéral ; barre d’outils (`AdminPlanDeTableToolbarComponent`) et export (`SeatingPlanExportService`) sont externalisés.
 */

/** Bloc « non placés » : une famille + ses personnes encore sans table sur la variante active. */
interface UnassignedFamilleBlock {
  familleId: number;
  title: string;
  personnes: PersonneRepasRow[];
}

/** Plafond zoom molette : assez haut pour pouvoir afficher un cadrillage à 1 cm sur de grandes salles. */
const SEATING_MAX_ZOOM_FACTOR = 1536;

@Component({
  selector: 'app-admin-plan-de-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatExpansionModule,
    MatDialogModule,
    AdminPlanDeTableToolbarComponent,
    AdminPlanDeTableCanvasComponent,
    AdminPlanDeTableSidePanelComponent,
  ],
  templateUrl: './admin-plan-de-table.component.html',
  styleUrls: ['./admin-plan-de-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlanDeTableComponent {
  /** Référence pour les sous-composants canvas / panneau latéral. */
  readonly planHost = this;

  /** Exposé au template : marge mur extérieur (cm). */
  readonly perimeterWallCm = SEATING_PERIMETER_WALL_CM;

  private seating = inject(SeatingPlanService);
  private seatingExport = inject(SeatingPlanExportService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private breakpoint = inject(BreakpointObserver);
  private destroyRef = inject(DestroyRef);

  /** Évite d’ouvrir la popup invités sur le 1ᵉʳ clic d’un double-clic (sélection panneau). */
  private assignTableClickTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Après un glisser-déposer invité (liste ou macaron), le navigateur émet encore un `click` sur le SVG
   * (souvent la table sous le curseur) : on ignore l’ouverture de la fenêtre « invités de la table »
   * pendant une courte fenêtre.
   */
  private assignTableDialogSuppressUntilMs = 0;

  planCanvas = viewChild(AdminPlanDeTableCanvasComponent);

  // --- Données métier (salle, variantes, plan courant, invités) ---
  loading = signal(true);
  noSchema = signal(false);
  venue = signal<SeatingVenue | null>(null);
  variants = signal<SeatingLayoutVariant[]>([]);
  selectedVariantId = signal<number | null>(null);
  walls = signal<SeatingWallSegment[]>([]);
  windows = signal<SeatingWindow[]>([]);
  doors = signal<SeatingDoor[]>([]);
  tables = signal<SeatingTable[]>([]);
  assignments = signal<SeatingAssignment[]>([]);
  personnes = signal<PersonneRepasRow[]>([]);

  // --- Vue canvas (mode édition, grille, zoom, pan) ---
  mode = signal<PlanMode>('assign');
  /** Masquée en mode Invités ; réaffichée en Pièce / Tables. */
  gridVisible = signal(false);
  /** Désactivé en mode Invités ; réactivé en Pièce / Tables. */
  snapEnabled = signal(false);
  /** Marqueur + libellé suivant la souris, magnétisé comme le reste du plan. */
  coordinateProbeEnabled = signal(false);

  /** Règle : 1er clic = origine, déplacement = distance affichée, 2ᵉ clic = efface. */
  measureToolEnabled = signal(false);
  measureOriginCm = signal<{ x: number; y: number } | null>(null);
  measureCursorCm = signal<{ x: number; y: number } | null>(null);

  measureHudLabel = computed(() => {
    const o = this.measureOriginCm();
    const c = this.measureCursorCm();
    if (!o || !c) return '';
    const d = Math.hypot(c.x - o.x, c.y - o.y);
    return `${Math.round(d)} cm`;
  });

  /** Texte d’aide au survol du bouton outil « coordonnées ». */
  coordinateProbeTooltip = computed(
    () =>
      `Coordonnées sous le curseur : point orange aligné sur le cadrillage (${this.gridStepDisplayLabel()}) lorsque le magnétisme est activé, sinon arrondi au centimètre. Origine (0, 0) en bas à gauche — x vers la droite, y vers le haut depuis le bas. Clic pour activer ou désactiver.`,
  );
  /** Position affichée (cm, repère SVG : origine haut-gauche), déjà snap + bornée à la pièce. */
  probeSnappedCm = signal<{ x: number; y: number } | null>(null);
  /**
   * Échelle de base (px/cm) pour que la salle tienne dans le viewport (mis à jour au resize).
   * Zoom utilisateur = zoomFactor × fitScale.
   */
  fitScale = signal(0.12);
  /** Facteur multiplicateur (1 = aperçu « tout visible »). Molette pour zoomer. */
  zoomFactor = signal(1);
  panX = signal(0);
  panY = signal(0);
  /** Après le 1er calcul taille viewport : échelle + centrage (zoom initial). */
  private initialViewportLayoutDone = false;

  effectivePxPerCm = computed(() => this.fitScale() * this.zoomFactor());

  /** Libellé coords avec origine bas-gauche (y compté depuis le bas de la pièce). */
  coordProbeHudLabel = computed(() => {
    const p = this.probeSnappedCm();
    const v = this.venue();
    if (!p || !v) return '';
    const yFromBottom = v.room_height_cm - p.y;
    return `${Math.round(p.x)} × ${Math.round(yFromBottom)} cm`;
  });

  /** Au-delà de ×10, affichage en facteur (×64) pour rester lisible avec un plafond de zoom élevé. */
  zoomPercentLabel = computed(() => {
    const z = this.zoomFactor();
    if (z <= 10) return `${Math.round(z * 100)} %`;
    return `×${Math.round(z)}`;
  });

  /**
   * Barre d’échelle (type Google Maps) : largeur en px à l’écran pour une distance réelle arrondie.
   */
  scaleLegend = computed(() => {
    const pxPerCm = this.effectivePxPerCm();
    if (pxPerCm <= 1e-9) {
      return { widthPx: 80, label: '—' };
    }
    const candidates = [
      2, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000,
      15000, 20000, 25000, 50000, 75000, 100000, 150000, 200000, 500000,
    ];
    const targetPx = 96;
    const minPx = 28;
    const maxPx = 220;
    let best = candidates[0];
    let bestDiff = Infinity;
    for (const d of candidates) {
      const wPx = d * pxPerCm;
      if (wPx < minPx || wPx > maxPx) continue;
      const diff = Math.abs(wPx - targetPx);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = d;
      }
    }
    if (bestDiff === Infinity) {
      for (const d of candidates) {
        const wPx = d * pxPerCm;
        const diff = Math.abs(wPx - targetPx);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = d;
        }
      }
    }
    const widthPx = Math.max(minPx, Math.round(best * pxPerCm));
    return {
      widthPx,
      label: this.formatScaleDistanceCm(best),
    };
  });

  /**
   * Pas du cadrillage affiché : de 1 m à 1 cm selon le zoom
   * (cible ~68 px par carreau à l’écran).
   */
  gridStepCm = computed(() => {
    const pxPerCm = this.effectivePxPerCm();
    const candidates = [100, 50, 20, 10, 5, 2, 1];
    const targetPx = 68;
    let best = 5;
    let bestDiff = Infinity;
    for (const step of candidates) {
      const px = step * pxPerCm;
      const diff = Math.abs(px - targetPx);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = step;
      }
    }
    return best;
  });

  gridStepDisplayLabel = computed(() => (this.gridStepCm() >= 100 ? '1 m' : `${this.gridStepCm()} cm`));

  gridFiligreeOutlineD = computed(() => {
    const S = this.gridStepCm();
    return `M ${S} 0 L 0 0 L 0 ${S}`;
  });

  gridFiligreeHooksD = computed(() => {
    const S = this.gridStepCm();
    const h = Math.max(0.2, S * 0.05);
    const e = S - h;
    return (
      `M 0 0 L 0 ${h} M 0 0 L ${h} 0 ` +
      `M ${S} 0 L ${e} 0 M ${S} 0 L ${S} ${h} ` +
      `M 0 ${S} L 0 ${e} M 0 ${S} L ${h} ${S} ` +
      `M ${S} ${S} L ${S} ${e} M ${S} ${S} L ${e} ${S}`
    );
  });

  /**
   * Rayons / traits en cm SVG mais calibrés pour rester lisibles au dézoom :
   * épaisseur cible ~constante en px (÷ pxPerCm), bornée pour ne pas envahir le carreau.
   */
  gridFiligreeNodeR = computed(() => {
    const S = this.gridStepCm();
    const pxPerCm = this.effectivePxPerCm();
    if (pxPerCm <= 1e-9) return Math.max(0.15, S * 0.028);
    const targetPx = 3.2;
    const rCm = targetPx / pxPerCm;
    return Math.max(0.12, Math.min(S * 0.12, rCm));
  });

  gridFiligreeStrokeMain = computed(() => {
    const S = this.gridStepCm();
    const pxPerCm = this.effectivePxPerCm();
    if (pxPerCm <= 1e-9) return Math.max(0.06, Math.min(0.18, S * 0.007));
    const targetPx = 1.08;
    const wCm = targetPx / pxPerCm;
    return Math.max(0.05, Math.min(S * 0.2, wCm));
  });

  gridFiligreeStrokeHook = computed(() => {
    const S = this.gridStepCm();
    const pxPerCm = this.effectivePxPerCm();
    if (pxPerCm <= 1e-9) return Math.max(0.07, Math.min(0.16, S * 0.0085));
    const targetPx = 1.18;
    const wCm = targetPx / pxPerCm;
    return Math.max(0.055, Math.min(S * 0.18, wCm));
  });

  gridFiligreeStrokeRing = computed(() => {
    const S = this.gridStepCm();
    const pxPerCm = this.effectivePxPerCm();
    if (pxPerCm <= 1e-9) return Math.max(0.05, Math.min(0.12, S * 0.006));
    const targetPx = 1.02;
    const wCm = targetPx / pxPerCm;
    return Math.max(0.045, Math.min(S * 0.16, wCm));
  });

  /** Premier point + épaisseur figée au 1ᵉʳ clic (le filigrane utilise cette épaisseur). */
  wallDraft = signal<{ x: number; y: number; thickness_cm: number } | null>(null);
  /** 2ᵉ extrémité suivie au curseur (repère plan cm), magnétisée comme le clic final. */
  wallDraftEndPreview = signal<{ x: number; y: number } | null>(null);
  selectedTableId = signal<number | null>(null);
  selectedWallId = signal<number | null>(null);

  draggingTableId = signal<number | null>(null);
  private dragTablePointerOffset = { x: 0, y: 0 };
  /** Ligne de base pour déplacement table en Maj (axe figé). */
  private tableDragFrozen = { x_cm: 0, y_cm: 0 };
  private tableAxisLock: 'h' | 'v' | null = null;

  /** Panoramique canvas (clic droit, milieu, ou Alt + clic gauche). */
  canvasPanning = signal(false);
  private canvasPanLast = { x: 0, y: 0 };
  private canvasPanAxisLock: 'h' | 'v' | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeObservedEl: HTMLElement | null = null;
  private viewportWheelEl: HTMLElement | null = null;
  private readonly onWheelBound = (ev: WheelEvent) => {
    if (this.readonlyLayout()) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.onViewportWheel(ev);
  };

  draggingPersonneId = signal<number | null>(null);

  /** Rayon du macaron invité sur le plan (cm) — diamètre 30 cm. */
  readonly chairMacaronRadiusCm = 15;

  /** Pendant un drag invité : position du fantôme (repère plan cm). */
  personneDragOverlayCm = signal<{ x: number; y: number } | null>(null);

  /** Table sous le curseur pendant le drag (surbrillance ok / interdit). */
  assignDropHighlightTableId = signal<number | null>(null);
  assignDropHighlightValid = signal(false);

  readonlyLayout = signal(false);

  /** Brouillon formulaire salle (hors signaux pour ngModel). */
  roomNameDraft = '';
  roomWidthDraft = 2000;
  roomHeightDraft = 1500;
  bgXDraft = 0;
  bgYDraft = 0;
  bgWDraft = 2000;
  bgHDraft = 1500;

  newTableShape: SeatingTableShape = 'round';

  /** Épaisseur du prochain mur (cm), avant le 1ᵉʳ clic. */
  wallNewThicknessCm = 12;

  /**
   * Section d’accordéon « Pièce » actuellement ouverte (une seule à la fois).
   * Le tracé des murs n’est actif que lorsque c’est `walls`.
   */
  roomAccordionSection = signal<'dimensions' | 'background' | 'walls' | 'windows' | 'doors' | 'freeforms' | null>(null);

  /** Mur dont la ligne est mise en surbrillance sur le plan (survol de la liste). */
  hoveredWallId = signal<number | null>(null);

  /** Fenêtre mise en surbrillance (survol de la liste). */
  hoveredWindowId = signal<number | null>(null);

  /** Largeur de la prochaine fenêtre (cm). */
  newWindowWidthCm = 120;

  /** Aperçu au survol (placement fenêtres actif) : segment sur le mur sous le curseur. */
  windowPlacementPreview = signal<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness: number;
  } | null>(null);

  hoveredDoorId = signal<number | null>(null);
  newDoorWidthCm = 90;
  newDoorKind: SeatingDoorKind = 'single';

  doorPlacementPreview = signal<{
    wall_segment_id: number | null;
    perimeter_edge: SeatingPerimeterEdge | null;
    offset_along_cm: number;
    width_cm: number;
    thickness_cm: number;
    door_kind: SeatingDoorKind;
    swing_sign: 1 | -1;
  } | null>(null);

  /** Polygones libres enregistrés (par salle). */
  freeforms = signal<SeatingFreeformPolygon[]>([]);

  /** Brouillon : sommets en cours (clics successifs). */
  freeformDraft = signal<{ points: { x: number; y: number }[] } | null>(null);

  /** Extrémité du fil à la souris (dernier sommet → curseur). */
  freeformRubberEndCm = signal<{ x: number; y: number } | null>(null);

  hoveredFreeformId = signal<number | null>(null);

  /** Épaisseur de trait des prochains polygones libres (cm). */
  newFreeformStrokeWidthCm = 3;

  /** Distance max (cm) pour cliquer sur le 1ᵉʳ point et fermer. */
  private readonly freeformCloseHitCm = 22;

  editTableLabel = '';
  editTableWidth = 120;
  editTableDepth = 120;
  editTableMaxChairs = 8;
  editTableRotation = 0;

  personneById = computed(() => {
    const m = new Map<number, PersonneRepasRow>();
    for (const p of this.personnes()) {
      m.set(p.id, p);
    }
    return m;
  });

  assignmentsByTable = computed(() => {
    const m = new Map<number, SeatingAssignment[]>();
    for (const a of this.assignments()) {
      const list = m.get(a.table_id) ?? [];
      list.push(a);
      m.set(a.table_id, list);
    }
    for (const list of m.values()) {
      list.sort((x, y) => x.seat_order - y.seat_order);
    }
    return m;
  });

  /** Invités repas non encore assignés à une table sur la variante sélectionnée. */
  unassignedPersonnes = computed(() => {
    const assigned = new Set(this.assignments().map((a) => a.personne_id));
    return this.personnes().filter((p) => !assigned.has(p.id));
  });

  /** Filtre prénom, nom ou libellé de famille (personne principale) sur les non placés. */
  assignListSearch = signal('');

  unassignedFamilleBlocks = computed((): UnassignedFamilleBlock[] => {
    const q = this.assignListSearch().trim().toLowerCase();
    const byId = this.personneById();
    let rows = this.unassignedPersonnes();
    if (q) {
      rows = rows.filter((p) => {
        const prenom = (p.prenom ?? '').toLowerCase();
        const nom = (p.nom ?? '').toLowerCase();
        const full = `${prenom} ${nom}`.trim();
        const familleLine = this.familleBlockTitle(p, byId).toLowerCase();
        return (
          prenom.includes(q) || nom.includes(q) || full.includes(q) || familleLine.includes(q)
        );
      });
    }
    const map = new Map<number, PersonneRepasRow[]>();
    for (const p of rows) {
      const fid = p.famille_id ?? 0;
      const list = map.get(fid) ?? [];
      list.push(p);
      map.set(fid, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.nom ?? '').localeCompare(b.nom ?? '', 'fr', { sensitivity: 'base' }) ||
          (a.prenom ?? '').localeCompare(b.prenom ?? '', 'fr', { sensitivity: 'base' }),
      );
    }
    const blocks: UnassignedFamilleBlock[] = [...map.entries()].map(([familleId, personnes]) => ({
      familleId,
      title: this.familleBlockTitle(personnes[0], byId),
      personnes,
    }));
    blocks.sort((a, b) =>
      a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }) || a.familleId - b.familleId,
    );
    return blocks;
  });

  unassignedFilteredCount = computed(() =>
    this.unassignedFamilleBlocks().reduce((s, b) => s + b.personnes.length, 0),
  );

  selectedVariant = computed(() => {
    const id = this.selectedVariantId();
    if (id == null) return null;
    return this.variants().find((v) => v.id === id) ?? null;
  });

  /** Tables triées pour la liste mobile (même ordre que l’export PDF). */
  tablesSortedForMobileList = computed(() =>
    [...this.tables()].sort(
      (a, b) =>
        (a.label ?? '').localeCompare(b.label ?? '', 'fr', { sensitivity: 'base' }) || a.id - b.id,
    ),
  );

  selectedTable = computed(() => {
    const id = this.selectedTableId();
    if (id == null) return null;
    return this.tables().find((t) => t.id === id) ?? null;
  });

  floorSvgViewBox = computed(() => {
    const v = this.venue();
    if (!v) return '0 0 100 100';
    const t = SEATING_PERIMETER_WALL_CM;
    const rw = v.room_width_cm;
    const rh = v.room_height_cm;
    return `${-t} ${-t} ${rw + 2 * t} ${rh + 2 * t}`;
  });

  /** Anneau extérieur (evenodd) : plein hors pièce, trou 0…rw × 0…rh. */
  outerWallRingPath = computed(() => {
    const v = this.venue();
    if (!v) return '';
    const t = SEATING_PERIMETER_WALL_CM;
    const rw = v.room_width_cm;
    const rh = v.room_height_cm;
    return (
      `M ${-t} ${-t} L ${rw + t} ${-t} L ${rw + t} ${rh + t} L ${-t} ${rh + t} Z ` +
      `M 0 0 L 0 ${rh} L ${rw} ${rh} L ${rw} 0 Z`
    );
  });

  constructor() {
    this.breakpoint.observe('(max-width: 959.98px)').subscribe((s) => this.readonlyLayout.set(s.matches));
    this.destroyRef.onDestroy(() => {
      this.clearAssignTableClickTimer();
      this.viewportWheelEl?.removeEventListener('wheel', this.onWheelBound, true);
      this.viewportWheelEl = null;
      this.resizeObservedEl = null;
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
    });
    effect(() => {
      if (this.loading() || this.venue() == null) return;
      untracked(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.attachViewportObserver());
        });
      });
    });
    void this.bootstrap();
  }

  async bootstrap() {
    this.loading.set(true);
    this.noSchema.set(false);
    const v = await this.seating.getVenue();
    if (!v) {
      this.noSchema.set(true);
      this.loading.set(false);
      return;
    }
    this.venue.set(v);
    this.syncRoomDraft(v);
    const vars = await this.seating.getVariants(v.id);
    this.variants.set(vars);
    if (vars.length) {
      this.selectedVariantId.set(vars[0].id);
      await this.reloadVariantData(vars[0].id);
    }
    this.personnes.set(await this.seating.getPersonnesRepas());
    this.loading.set(false);
  }

  /**
   * Attache molette (non passive) + ResizeObserver sur le viewport quand le DOM est prêt.
   * Réessaie si le viewport du sous-composant canvas change ou si le viewChild n’est pas encore résolu.
   */
  private attachViewportObserver(retry = 0) {
    const el = this.planCanvas()?.getViewportElement();
    if (!el) {
      if (retry < 12 && !this.loading() && this.venue() != null) {
        requestAnimationFrame(() => this.attachViewportObserver(retry + 1));
      }
      return;
    }

    if (this.viewportWheelEl !== el) {
      if (this.viewportWheelEl) {
        this.viewportWheelEl.removeEventListener('wheel', this.onWheelBound, true);
      }
      this.viewportWheelEl = el;
      el.addEventListener('wheel', this.onWheelBound, { passive: false, capture: true });
    }

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.onViewportResize());
      this.resizeObserver.observe(el);
      this.resizeObservedEl = el;
      this.onViewportResize();
    } else if (this.resizeObservedEl !== el) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(el);
      this.resizeObservedEl = el;
      this.onViewportResize();
    }
  }

  private canvasTotalWidthCm(v: SeatingVenue): number {
    return seatingCanvasOuterSizeCm(v).widthCm;
  }

  private canvasTotalHeightCm(v: SeatingVenue): number {
    return seatingCanvasOuterSizeCm(v).heightCm;
  }

  private onViewportResize() {
    const v = this.venue();
    const el = this.planCanvas()?.getViewportElement();
    if (!v || !el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw < 16 || vh < 16) return;
    const cwCm = this.canvasTotalWidthCm(v);
    const chCm = this.canvasTotalHeightCm(v);
    const newS = Math.min(vw / cwCm, vh / chCm);

    if (!this.initialViewportLayoutDone) {
      this.initialViewportLayoutDone = true;
      this.fitScale.set(Math.max(0.0001, newS));
      this.centerPan();
      return;
    }

    const z = this.zoomFactor();
    const oldS = this.fitScale();
    const oldCw = cwCm * oldS * z;
    const oldCh = chCm * oldS * z;
    const newCw = cwCm * newS * z;
    const newCh = chCm * newS * z;
    if (oldS > 0 && oldCw > 0 && oldCh > 0) {
      const fx = (vw / 2 - this.panX()) / oldCw;
      const fy = (vh / 2 - this.panY()) / oldCh;
      this.fitScale.set(Math.max(0.0001, newS));
      this.panX.set(vw / 2 - fx * newCw);
      this.panY.set(vh / 2 - fy * newCh);
    } else {
      this.fitScale.set(Math.max(0.0001, newS));
      this.centerPan();
    }
  }

  private centerPan() {
    const v = this.venue();
    const el = this.planCanvas()?.getViewportElement();
    if (!v || !el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const cw = this.canvasTotalWidthCm(v) * this.fitScale() * this.zoomFactor();
    const ch = this.canvasTotalHeightCm(v) * this.fitScale() * this.zoomFactor();
    this.panX.set((vw - cw) / 2);
    this.panY.set((vh - ch) / 2);
  }

  resetView() {
    this.zoomFactor.set(1);
    this.centerPan();
  }

  onViewportWheel(ev: WheelEvent) {
    const v = this.venue();
    const host = this.planCanvas()?.getViewportElement();
    if (!v || !host) return;
    const rect = host.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const z0 = this.zoomFactor();
    const s = this.fitScale();
    const cwCm = this.canvasTotalWidthCm(v);
    const chCm = this.canvasTotalHeightCm(v);
    const cw0 = cwCm * s * z0;
    const ch0 = chCm * s * z0;
    const fx = cw0 > 0 ? (mx - this.panX()) / cw0 : 0.5;
    const fy = ch0 > 0 ? (my - this.panY()) / ch0 : 0.5;
    const step = Math.exp(-ev.deltaY * 0.0012);
    const z1 = Math.min(SEATING_MAX_ZOOM_FACTOR, Math.max(0.2, z0 * step));
    const cw1 = cwCm * s * z1;
    const ch1 = chCm * s * z1;
    this.zoomFactor.set(z1);
    this.panX.set(mx - fx * cw1);
    this.panY.set(my - fy * ch1);
  }

  onViewportPointerDown(ev: MouseEvent) {
    if (this.readonlyLayout()) return;
    if (ev.button === 2 && this.mode() === 'room' && this.roomAccordionSection() === 'freeforms' && this.freeformDraft() != null) {
      return;
    }
    const wantPan = ev.button === 2 || ev.button === 1 || (ev.button === 0 && ev.altKey);
    if (!wantPan) return;
    const el = ev.target as HTMLElement | null;
    if (el?.closest?.('.table-group')) return;
    ev.preventDefault();
    this.canvasPanning.set(true);
    this.canvasPanLast = { x: ev.clientX, y: ev.clientY };
    this.canvasPanAxisLock = null;
  }

  /** Empêche le menu contextuel au clic droit sur le canevas (utilisé pour le panoramique). */
  onViewportContextMenu(ev: MouseEvent) {
    if (this.readonlyLayout()) return;
    ev.preventDefault();
    if (this.mode() === 'room' && this.roomAccordionSection() === 'freeforms') {
      void this.tryCloseFreeformDraftFromContextMenu();
    }
  }

  private formatScaleDistanceCm(cm: number): string {
    if (cm >= 100000) {
      const km = cm / 100000;
      return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
    }
    if (cm >= 1000) {
      const m = cm / 100;
      return Math.abs(m - Math.round(m)) < 0.05 ? `${Math.round(m)} m` : `${m.toFixed(1)} m`;
    }
    return `${cm} cm`;
  }

  private syncRoomDraft(v: SeatingVenue) {
    this.roomNameDraft = v.name;
    this.roomWidthDraft = v.room_width_cm;
    this.roomHeightDraft = v.room_height_cm;
    this.bgXDraft = v.background_x_cm;
    this.bgYDraft = v.background_y_cm;
    this.bgWDraft = v.background_width_cm ?? v.room_width_cm;
    this.bgHDraft = v.background_height_cm ?? v.room_height_cm;
  }

  async reloadVariantData(variantId: number) {
    const v = this.venue();
    if (!v) return;
    this.walls.set(await this.seating.getWalls(v.id));
    this.windows.set(await this.seating.getWindows(v.id));
    this.doors.set(await this.seating.getDoors(v.id));
    this.freeforms.set(await this.seating.getFreeformPolygons(v.id));
    this.tables.set(await this.seating.getTables(variantId));
    this.assignments.set(await this.seating.getAssignments(variantId));
  }

  async onVariantChange(id: number) {
    this.selectedVariantId.set(id);
    this.assignListSearch.set('');
    this.selectedTableId.set(null);
    this.wallDraft.set(null);
    this.wallDraftEndPreview.set(null);
    this.hoveredWallId.set(null);
    this.hoveredWindowId.set(null);
    this.windowPlacementPreview.set(null);
    this.doorPlacementPreview.set(null);
    this.hoveredDoorId.set(null);
    this.freeformDraft.set(null);
    this.freeformRubberEndCm.set(null);
    this.hoveredFreeformId.set(null);
    await this.reloadVariantData(id);
  }

  async saveVenueBasics() {
    const v = this.venue();
    if (!v || this.readonlyLayout()) return;
    const ok = await this.seating.updateVenue(v.id, {
      name: this.roomNameDraft.trim() || v.name,
      room_width_cm: Math.max(100, Math.round(this.roomWidthDraft)),
      room_height_cm: Math.max(100, Math.round(this.roomHeightDraft)),
    });
    if (ok) {
      this.venue.set({
        ...v,
        name: this.roomNameDraft.trim() || v.name,
        room_width_cm: Math.max(100, Math.round(this.roomWidthDraft)),
        room_height_cm: Math.max(100, Math.round(this.roomHeightDraft)),
      });
      this.snack.open('Salle enregistrée', '', { duration: 2000 });
    }
  }

  async saveBackgroundPlacement() {
    const v = this.venue();
    if (!v || this.readonlyLayout()) return;
    const ok = await this.seating.updateVenue(v.id, {
      background_x_cm: Math.round(this.bgXDraft),
      background_y_cm: Math.round(this.bgYDraft),
      background_width_cm: Math.max(10, Math.round(this.bgWDraft)),
      background_height_cm: Math.max(10, Math.round(this.bgHDraft)),
    });
    if (ok) {
      this.venue.set({
        ...v,
        background_x_cm: Math.round(this.bgXDraft),
        background_y_cm: Math.round(this.bgYDraft),
        background_width_cm: Math.max(10, Math.round(this.bgWDraft)),
        background_height_cm: Math.max(10, Math.round(this.bgHDraft)),
      });
      this.snack.open('Fond mis à jour', '', { duration: 2000 });
    }
  }

  onBackgroundFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.readonlyLayout()) return;
    if (file.size > 6 * 1024 * 1024) {
      this.snack.open('Image trop lourde (max ~6 Mo)', '', { duration: 4000 });
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const v = this.venue();
      if (!v) return;
      const dataUrl = reader.result as string;
      const bw = Math.max(10, Math.round(this.bgWDraft));
      const bh = Math.max(10, Math.round(this.bgHDraft));
      const ok = await this.seating.updateVenue(v.id, {
        background_data_url: dataUrl,
        background_width_cm: bw,
        background_height_cm: bh,
        background_x_cm: Math.round(this.bgXDraft),
        background_y_cm: Math.round(this.bgYDraft),
      });
      if (ok) {
        this.venue.set({
          ...v,
          background_data_url: dataUrl,
          background_width_cm: bw,
          background_height_cm: bh,
        });
        this.snack.open('Image de fond importée', '', { duration: 2000 });
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  async clearBackground() {
    const v = this.venue();
    if (!v || this.readonlyLayout()) return;
    const ok = await this.seating.updateVenue(v.id, {
      background_data_url: null,
      background_width_cm: null,
      background_height_cm: null,
    });
    if (ok) {
      this.venue.set({ ...v, background_data_url: null, background_width_cm: null, background_height_cm: null });
      this.snack.open('Fond retiré', '', { duration: 2000 });
    }
  }

  async addVariant() {
    const v = this.venue();
    if (!v || this.readonlyLayout()) return;
    const defaultName = `Variante ${this.variants().length + 1}`;
    const entered = await this.promptVariantName({
      title: 'Nouvelle variante',
      defaultName,
      confirmLabel: 'Créer',
    });
    if (entered === null) return;
    const name = entered.trim() || defaultName;
    const created = await this.seating.createVariant(v.id, name);
    if (created) {
      this.variants.set([...this.variants(), created]);
      await this.onVariantChange(created.id);
      this.snack.open('Variante créée', '', { duration: 2000 });
    }
  }

  async deleteCurrentVariant() {
    const vid = this.selectedVariantId();
    if (vid == null || this.variants().length <= 1 || this.readonlyLayout()) return;
    if (!confirm('Supprimer cette variante et ses tables / affectations ?')) return;
    const ok = await this.seating.deleteVariant(vid);
    if (ok) {
      const rest = this.variants().filter((x) => x.id !== vid);
      this.variants.set(rest);
      if (rest.length) {
        await this.onVariantChange(rest[0].id);
      }
      this.snack.open('Variante supprimée', '', { duration: 2000 });
    }
  }

  async copyCurrentVariant() {
    const vid = this.selectedVariantId();
    const v = this.venue();
    const src = this.selectedVariant();
    if (vid == null || !v || this.readonlyLayout()) return;
    const defaultName = src ? `${src.name} (copie)` : 'Copie';
    const entered = await this.promptVariantName({
      title: 'Copier la variante',
      defaultName,
      confirmLabel: 'Copier',
    });
    if (entered === null) return;
    const name = entered.trim() || defaultName;
    const copy = await this.seating.copyVariant(vid, name);
    if (copy) {
      this.variants.set(await this.seating.getVariants(v.id));
      await this.onVariantChange(copy.id);
      this.snack.open('Variante copiée', '', { duration: 2000 });
    } else {
      this.snack.open('Copie impossible (réseau ou base de données).', '', { duration: 4000 });
    }
  }

  /** `null` si annulation ; chaîne (éventuellement vide) si validation — utiliser un défaut côté appelant si besoin. */
  private async promptVariantName(data: {
    title: string;
    defaultName: string;
    confirmLabel: string;
  }): Promise<string | null> {
    const ref = this.dialog.open(VariantNameDialogComponent, {
      width: '360px',
      maxWidth: '95vw',
      autoFocus: 'first-tick',
      data,
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (result === undefined) return null;
    return result;
  }

  async addTable() {
    const vid = this.selectedVariantId();
    const v = this.venue();
    if (vid == null || !v || this.readonlyLayout()) return;
    const step = this.gridStepCm();
    let cx = snapCm(v.room_width_cm / 2, step);
    let cy = snapCm(v.room_height_cm / 2, step);
    if (!this.snapEnabled()) {
      cx = Math.round(v.room_width_cm / 2);
      cy = Math.round(v.room_height_cm / 2);
    }
    let w = 120;
    let d = 120;
    if (this.newTableShape === 'rect') {
      w = 200;
      d = 100;
    }
    if (this.newTableShape === 'oval') {
      w = 200;
      d = 120;
    }
    const t = await this.seating.createTable(vid, this.newTableShape, cx, cy, w, d, 8);
    if (t) {
      this.tables.set([...this.tables(), t]);
      this.selectedTableId.set(t.id);
      this.syncEditFromTable(t);
      this.snack.open('Table ajoutée', '', { duration: 2000 });
    }
  }

  selectTable(id: number) {
    this.selectedTableId.set(id);
    const t = this.tables().find((x) => x.id === id);
    if (t) this.syncEditFromTable(t);
  }

  syncEditFromTable(t: SeatingTable) {
    this.editTableLabel = t.label ?? '';
    this.editTableWidth = t.width_cm;
    this.editTableDepth = t.shape === 'round' ? t.width_cm : t.depth_cm;
    this.editTableMaxChairs = t.max_chairs;
    this.editTableRotation = t.rotation_deg;
  }

  async applyTableEdits() {
    const t = this.selectedTable();
    if (!t || this.readonlyLayout()) return;
    // Largeur / profondeur : cm entiers uniquement — pas le pas du quadrillage (souvent 50–100 cm au dézoom),
    // sinon p.ex. 150 → snap à 200 et les deux champs semblent « sauter ».
    const w = Math.max(1, Math.round(Number(this.editTableWidth) || 0));
    let d = Math.max(1, Math.round(Number(this.editTableDepth) || 0));
    if (t.shape === 'round') {
      d = w;
    }
    const ok = await this.seating.updateTable(t.id, {
      label: this.editTableLabel.trim() || null,
      width_cm: w,
      depth_cm: d,
      max_chairs: Math.max(1, Math.round(this.editTableMaxChairs)),
      rotation_deg: Math.round(this.editTableRotation),
    });
    if (ok) {
      this.tables.set(
        this.tables().map((x) =>
          x.id === t.id
            ? {
                ...x,
                label: this.editTableLabel.trim() || null,
                width_cm: w,
                depth_cm: d,
                max_chairs: Math.max(1, Math.round(this.editTableMaxChairs)),
                rotation_deg: Math.round(this.editTableRotation),
              }
            : x,
        ),
      );
      this.snack.open('Table mise à jour', '', { duration: 2000 });
    }
  }

  async deleteSelectedTable() {
    const t = this.selectedTable();
    if (!t || this.readonlyLayout()) return;
    if (!confirm('Supprimer cette table ?')) return;
    const ok = await this.seating.deleteTable(t.id);
    if (ok) {
      this.tables.set(this.tables().filter((x) => x.id !== t.id));
      this.selectedTableId.set(null);
      this.assignments.set(this.assignments().filter((a) => a.table_id !== t.id));
    }
  }

  async deleteWall(id: number) {
    if (this.readonlyLayout()) return;
    const ok = await this.seating.deleteWallSegment(id);
    if (ok) {
      this.walls.set(this.walls().filter((w) => w.id !== id));
      const v = this.venue();
      if (v) {
        this.windows.set(await this.seating.getWindows(v.id));
        this.doors.set(await this.seating.getDoors(v.id));
      }
    }
  }

  cancelWallDraft() {
    this.wallDraft.set(null);
    this.wallDraftEndPreview.set(null);
  }

  onRoomPanelOpened(section: 'dimensions' | 'background' | 'walls' | 'windows' | 'doors' | 'freeforms') {
    this.roomAccordionSection.set(section);
  }

  onRoomPanelClosed(section: 'dimensions' | 'background' | 'walls' | 'windows' | 'doors' | 'freeforms') {
    if (this.roomAccordionSection() === section) {
      this.roomAccordionSection.set(null);
    }
    if (section === 'walls') {
      this.cancelWallDraft();
      this.hoveredWallId.set(null);
    }
    if (section === 'windows') {
      this.hoveredWindowId.set(null);
      this.windowPlacementPreview.set(null);
    }
    if (section === 'doors') {
      this.hoveredDoorId.set(null);
      this.doorPlacementPreview.set(null);
    }
    if (section === 'freeforms') {
      this.hoveredFreeformId.set(null);
      this.freeformDraft.set(null);
      this.freeformRubberEndCm.set(null);
    }
  }

  setHoveredWall(id: number) {
    this.hoveredWallId.set(id);
  }

  clearHoveredWall() {
    this.hoveredWallId.set(null);
  }

  setHoveredWindow(id: number) {
    this.hoveredWindowId.set(id);
  }

  clearHoveredWindow() {
    this.hoveredWindowId.set(null);
  }

  windowEndpointsForRender(w: SeatingWindow): { x1: number; y1: number; x2: number; y2: number } | null {
    const v = this.venue();
    if (!v) return null;
    return windowOpeningEndpoints(w, this.walls(), v.room_width_cm, v.room_height_cm);
  }

  windowLineStrokeWidthCm(w: SeatingWindow): number {
    const base = w.thickness_cm;
    return this.hoveredWindowId() === w.id ? Math.min(500, Math.round(base * 1.35)) : base;
  }

  windowSummary(w: SeatingWindow): string {
    const edgeFr: Record<string, string> = { north: 'Nord', east: 'Est', south: 'Sud', west: 'Ouest' };
    if (w.perimeter_edge) {
      return `${edgeFr[w.perimeter_edge] ?? w.perimeter_edge} · ${w.width_cm} cm (ép. ${w.thickness_cm})`;
    }
    return `Mur #${w.wall_segment_id} · ${w.width_cm} cm (ép. ${w.thickness_cm})`;
  }

  async deleteWindow(id: number) {
    if (this.readonlyLayout()) return;
    const ok = await this.seating.deleteWindow(id);
    if (ok) {
      this.windows.set(this.windows().filter((x) => x.id !== id));
      if (this.hoveredWindowId() === id) this.hoveredWindowId.set(null);
    }
  }

  /** Ouverture sur mur (fenêtre / porte / etc.) : géométrie commune. */
  private computeWallOpeningPlacementAtPoint(
    px: number,
    py: number,
    widthCm: number,
  ):
    | {
        ok: true;
        insert: {
          venue_id: number;
          wall_segment_id: number | null;
          perimeter_edge: SeatingPerimeterEdge | null;
          offset_along_cm: number;
          width_cm: number;
          thickness_cm: number;
        };
        endpoints: { x1: number; y1: number; x2: number; y2: number };
      }
    | { ok: false; reason: 'far' | 'wide' } {
    const v = this.venue();
    if (!v) return { ok: false, reason: 'far' };
    const width = Math.max(1, Math.min(5000, Math.round(widthCm)));
    const maxDist = 55;
    const hit = findClosestWallHit(
      px,
      py,
      this.walls(),
      v.room_width_cm,
      v.room_height_cm,
      SEATING_PERIMETER_WALL_CM,
      maxDist,
    );
    if (!hit) return { ok: false, reason: 'far' };
    const L = hit.target.lengthCm;
    let along = hit.alongCm;
    if (this.snapEnabled()) {
      along = snapCm(along, this.gridStepCm());
    } else {
      along = Math.round(along);
    }
    const center = clampWindowCenterAlong(along, width, L);
    if (center == null) return { ok: false, reason: 'wide' };
    const thickness_cm = Math.round(hit.target.thickness_cm);
    const insert =
      hit.target.kind === 'segment'
        ? {
            venue_id: v.id,
            wall_segment_id: hit.target.wallSegmentId,
            perimeter_edge: null as null,
            offset_along_cm: center,
            width_cm: width,
            thickness_cm,
          }
        : {
            venue_id: v.id,
            wall_segment_id: null as null,
            perimeter_edge: hit.target.edge,
            offset_along_cm: center,
            width_cm: width,
            thickness_cm,
          };
    const endpoints = windowOpeningEndpoints(
      {
        wall_segment_id: insert.wall_segment_id,
        perimeter_edge: insert.perimeter_edge,
        offset_along_cm: center,
        width_cm: width,
      },
      this.walls(),
      v.room_width_cm,
      v.room_height_cm,
    );
    if (!endpoints) return { ok: false, reason: 'wide' };
    return { ok: true, insert, endpoints };
  }

  private computeWindowPlacementAtPoint(
    px: number,
    py: number,
  ):
    | {
        ok: true;
        insert: {
          venue_id: number;
          wall_segment_id: number | null;
          perimeter_edge: SeatingPerimeterEdge | null;
          offset_along_cm: number;
          width_cm: number;
          thickness_cm: number;
        };
        endpoints: { x1: number; y1: number; x2: number; y2: number };
      }
    | { ok: false; reason: 'far' | 'wide' } {
    const width = Math.max(5, Math.min(5000, Math.round(this.newWindowWidthCm)));
    return this.computeWallOpeningPlacementAtPoint(px, py, width);
  }

  private computeDoorPlacementAtPoint(
    px: number,
    py: number,
  ):
    | {
        ok: true;
        insert: {
          venue_id: number;
          wall_segment_id: number | null;
          perimeter_edge: SeatingPerimeterEdge | null;
          offset_along_cm: number;
          width_cm: number;
          thickness_cm: number;
          door_kind: SeatingDoorKind;
        };
        endpoints: { x1: number; y1: number; x2: number; y2: number };
      }
    | { ok: false; reason: 'far' | 'wide' } {
    const width = Math.max(30, Math.min(5000, Math.round(this.newDoorWidthCm)));
    const r = this.computeWallOpeningPlacementAtPoint(px, py, width);
    if (!r.ok) return r;
    return {
      ok: true,
      insert: { ...r.insert, door_kind: this.newDoorKind },
      endpoints: r.endpoints,
    };
  }

  private updateWindowPlacementPreview(clientX: number, clientY: number) {
    if (this.readonlyLayout() || this.mode() !== 'room' || this.roomAccordionSection() !== 'windows') {
      this.windowPlacementPreview.set(null);
      return;
    }
    const cm = this.clientToCm(clientX, clientY);
    if (!cm) {
      this.windowPlacementPreview.set(null);
      return;
    }
    const r = this.computeWindowPlacementAtPoint(cm.x, cm.y);
    if (r.ok) {
      this.windowPlacementPreview.set({
        ...r.endpoints,
        thickness: r.insert.thickness_cm,
      });
    } else {
      this.windowPlacementPreview.set(null);
    }
  }

  private async tryPlaceWindowFromClick(px: number, py: number) {
    if (this.readonlyLayout()) return;
    const r = this.computeWindowPlacementAtPoint(px, py);
    if (!r.ok) {
      if (r.reason === 'far') {
        this.snack.open('Cliquez près d’un mur (segment intérieur ou mur du pourtour).', '', { duration: 2800 });
      } else {
        this.snack.open('La fenêtre est trop large pour ce mur.', '', { duration: 3200 });
      }
      return;
    }
    const win = await this.seating.addWindow(r.insert);
    if (!win) {
      this.snack.open('Fenêtre non enregistrée (migration seating_window ou droits).', '', { duration: 4500 });
      return;
    }
    this.windows.set([...this.windows(), win]);
  }

  private computeDoorSwingSignFromEndpoints(
    pointerX: number,
    pointerY: number,
    end: { x1: number; y1: number; x2: number; y2: number },
    perimeterEdge: SeatingPerimeterEdge | null,
    roomW: number,
    roomH: number,
  ): 1 | -1 {
    const w = Math.hypot(end.x2 - end.x1, end.y2 - end.y1);
    if (w < 1) return 1;
    const tx = (end.x2 - end.x1) / w;
    const ty = (end.y2 - end.y1) / w;
    const midX = (end.x1 + end.x2) / 2;
    const midY = (end.y1 + end.y2) / 2;
    const { nx, ny } = doorOpeningInwardNormal(perimeterEdge, midX, midY, tx, ty, roomW, roomH);
    return doorSwingSignTowardPointer(pointerX, pointerY, midX, midY, nx, ny);
  }

  private refreshDoorPlacementPreview(clientX: number, clientY: number) {
    if (this.readonlyLayout() || this.mode() !== 'room' || this.roomAccordionSection() !== 'doors') {
      this.doorPlacementPreview.set(null);
      return;
    }
    const v = this.venue();
    if (!v) return;
    const cm = this.clientToCm(clientX, clientY);

    if (!cm) {
      this.doorPlacementPreview.set(null);
      return;
    }
    const r = this.computeDoorPlacementAtPoint(cm.x, cm.y);
    if (!r.ok) {
      this.doorPlacementPreview.set(null);
      return;
    }
    const swing =
      r.insert.door_kind === 'opening'
        ? (1 as const)
        : this.computeDoorSwingSignFromEndpoints(cm.x, cm.y, r.endpoints, r.insert.perimeter_edge, v.room_width_cm, v.room_height_cm);
    this.doorPlacementPreview.set({ ...r.insert, swing_sign: swing });
  }

  private async tryPlaceDoorFromClick(px: number, py: number, clientX: number, clientY: number) {
    if (this.readonlyLayout()) return;
    const r = this.computeDoorPlacementAtPoint(px, py);
    if (!r.ok) {
      if (r.reason === 'far') {
        this.snack.open('Cliquez près d’un mur pour placer la porte ou l’ouverture.', '', { duration: 2800 });
      } else {
        this.snack.open('Largeur trop grande pour ce mur.', '', { duration: 3200 });
      }
      return;
    }
    const v = this.venue();
    if (!v) return;
    const cmClick = this.clientToCm(clientX, clientY);
    const midX = (r.endpoints.x1 + r.endpoints.x2) / 2;
    const midY = (r.endpoints.y1 + r.endpoints.y2) / 2;
    const swingPx = cmClick?.x ?? midX;
    const swingPy = cmClick?.y ?? midY;
    const swing =
      r.insert.door_kind === 'opening'
        ? (1 as const)
        : this.computeDoorSwingSignFromEndpoints(swingPx, swingPy, r.endpoints, r.insert.perimeter_edge, v.room_width_cm, v.room_height_cm);
    const d = await this.seating.addDoor({ ...r.insert, swing_sign: swing });
    if (!d) {
      this.snack.open('Enregistrement impossible (table seating_door ou droits).', '', { duration: 4500 });
      return;
    }
    this.doors.set([...this.doors(), d]);
  }

  doorPlanElementsForPlaced(door: SeatingDoor): DoorPlanElement[] {
    const v = this.venue();
    if (!v) return [];
    const end = windowOpeningEndpoints(door, this.walls(), v.room_width_cm, v.room_height_cm);
    if (!end) return [];
    const swing: 1 | -1 = door.swing_sign === -1 ? -1 : 1;
    return doorPlanGraphics(
      door.door_kind,
      end,
      door.thickness_cm,
      door.perimeter_edge,
      v.room_width_cm,
      v.room_height_cm,
      swing,
    );
  }

  doorPlanElementsFromPreview(): DoorPlanElement[] {
    const p = this.doorPlacementPreview();
    const v = this.venue();
    if (!p || !v) return [];
    const end = windowOpeningEndpoints(p, this.walls(), v.room_width_cm, v.room_height_cm);
    if (!end) return [];
    return doorPlanGraphics(p.door_kind, end, p.thickness_cm, p.perimeter_edge, v.room_width_cm, v.room_height_cm, p.swing_sign);
  }

  doorSummary(d: SeatingDoor): string {
    const kindFr: Record<SeatingDoorKind, string> = {
      single: 'Porte simple',
      double: 'Porte double',
      opening: 'Ouverture',
    };
    const edgeFr: Record<string, string> = { north: 'Nord', east: 'Est', south: 'Sud', west: 'Ouest' };
    const loc = d.perimeter_edge ? edgeFr[d.perimeter_edge] ?? d.perimeter_edge : `Mur #${d.wall_segment_id}`;
    return `${kindFr[d.door_kind]} · ${loc} · ${d.width_cm} cm`;
  }

  async deleteDoor(id: number) {
    if (this.readonlyLayout()) return;
    const ok = await this.seating.deleteDoor(id);
    if (ok) {
      this.doors.set(this.doors().filter((x: SeatingDoor) => x.id !== id));
      if (this.hoveredDoorId() === id) this.hoveredDoorId.set(null);
    }
  }

  setHoveredDoor(id: number) {
    this.hoveredDoorId.set(id);
  }

  clearHoveredDoor() {
    this.hoveredDoorId.set(null);
  }

  private snapFreeformCm(x: number, y: number, v: SeatingVenue): { x: number; y: number } {
    const snapped = this.applySnap(x, y);
    return {
      x: Math.max(0, Math.min(v.room_width_cm, snapped.x)),
      y: Math.max(0, Math.min(v.room_height_cm, snapped.y)),
    };
  }

  private updateFreeformRubber(clientX: number, clientY: number) {
    const v = this.venue();
    if (!v || this.freeformDraft() == null) {
      this.freeformRubberEndCm.set(null);
      return;
    }
    const cm = this.clientToCm(clientX, clientY);
    if (!cm) {
      this.freeformRubberEndCm.set(null);
      return;
    }
    this.freeformRubberEndCm.set(this.snapFreeformCm(cm.x, cm.y, v));
  }

  private isNearFreeformFirstPoint(px: number, py: number, draft: { points: { x: number; y: number }[] }): boolean {
    if (draft.points.length < 1) return false;
    const p0 = draft.points[0];
    return Math.hypot(px - p0.x, py - p0.y) <= this.freeformCloseHitCm;
  }

  private async tryCloseFreeformDraftFromContextMenu() {
    const draft = this.freeformDraft();
    if (draft == null) return;
    if (draft.points.length < 3) {
      this.snack.open('Au moins 3 sommets pour fermer le polygone.', '', { duration: 2800 });
      return;
    }
    await this.finalizeFreeformDraft();
  }

  private async finalizeFreeformDraft() {
    const v = this.venue();
    const draft = this.freeformDraft();
    if (!v || draft == null || draft.points.length < 3) return;
    const stroke = Math.max(0.5, Math.min(80, Number(this.newFreeformStrokeWidthCm) || 3));
    const pairs: [number, number][] = draft.points.map((p) => [Math.round(p.x), Math.round(p.y)]);
    const row = await this.seating.addFreeformPolygon(v.id, pairs, stroke);
    if (!row) {
      this.snack.open('Polygone non enregistré (migration seating_freeform_polygon ou droits).', '', { duration: 4500 });
      return;
    }
    this.freeforms.set([...this.freeforms(), row]);
    this.freeformDraft.set(null);
    this.freeformRubberEndCm.set(null);
  }

  private async handleFreeformSvgClick(px: number, py: number) {
    if (this.readonlyLayout()) return;
    const v = this.venue();
    if (!v) return;
    const p = this.snapFreeformCm(px, py, v);
    const draft = this.freeformDraft();

    if (draft != null && draft.points.length >= 3 && this.isNearFreeformFirstPoint(p.x, p.y, draft)) {
      await this.finalizeFreeformDraft();
      return;
    }

    if (draft != null && draft.points.length >= 1 && this.isNearFreeformFirstPoint(p.x, p.y, draft) && draft.points.length < 3) {
      this.snack.open('Ajoutez au moins 3 sommets avant de fermer (ou clic droit après 3 sommets).', '', { duration: 2800 });
      return;
    }

    if (draft == null) {
      this.freeformDraft.set({ points: [{ x: p.x, y: p.y }] });
      return;
    }

    const last = draft.points[draft.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.5) return;

    this.freeformDraft.set({ points: [...draft.points, { x: p.x, y: p.y }] });
  }

  freeformPolygonPathD(poly: SeatingFreeformPolygon): string {
    const pts = poly.points_cm;
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i][0]} ${pts[i][1]}`;
    }
    return `${d} Z`;
  }

  freeformDraftOpenPathD(): string {
    const draft = this.freeformDraft();
    if (!draft?.points.length) return '';
    const pts = draft.points;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  freeformDraftRubberPathD(): string | null {
    const draft = this.freeformDraft();
    const r = this.freeformRubberEndCm();
    if (!draft?.points.length || !r) return null;
    const last = draft.points[draft.points.length - 1];
    return `M ${last.x} ${last.y} L ${r.x} ${r.y}`;
  }

  freeformStrokeWidthRender(f: SeatingFreeformPolygon): number {
    const base = Math.max(0.5, f.stroke_width_cm);
    return this.hoveredFreeformId() === f.id ? Math.min(120, base * 1.4) : base;
  }

  freeformVertexHandleRCm(): number {
    return 5;
  }

  freeformSummary(f: SeatingFreeformPolygon): string {
    return `Polygone · ${f.points_cm.length} sommet${f.points_cm.length > 1 ? 's' : ''}`;
  }

  async deleteFreeform(id: number) {
    if (this.readonlyLayout()) return;
    const ok = await this.seating.deleteFreeformPolygon(id);
    if (ok) {
      this.freeforms.set(this.freeforms().filter((x) => x.id !== id));
      if (this.hoveredFreeformId() === id) this.hoveredFreeformId.set(null);
    }
  }

  setHoveredFreeform(id: number) {
    this.hoveredFreeformId.set(id);
  }

  clearHoveredFreeform() {
    this.hoveredFreeformId.set(null);
  }

  /** Largeur de trait (cm) : surbrillance au survol de la liste. */
  wallLineStrokeWidthCm(w: SeatingWallSegment): number {
    const base = this.wallStrokeCm(w);
    return this.hoveredWallId() === w.id ? Math.min(500, Math.round(base * 1.45)) : base;
  }

  private clampWallThicknessCm(raw: number): number {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 4;
    return Math.max(1, Math.min(500, n));
  }

  wallStrokeCm(w: SeatingWallSegment): number {
    return w.thickness_cm ?? 4;
  }

  private updateWallDraftPreviewFromClient(clientX: number, clientY: number) {
    const v = this.venue();
    if (!v) return;
    const cm = this.clientToCm(clientX, clientY);
    if (!cm) return;
    const snapped = this.applySnap(cm.x, cm.y);
    this.wallDraftEndPreview.set({
      x: Math.max(0, Math.min(v.room_width_cm, snapped.x)),
      y: Math.max(0, Math.min(v.room_height_cm, snapped.y)),
    });
  }

  tableGroupTransform(t: SeatingTable): string {
    return `translate(${t.center_x_cm},${t.center_y_cm}) rotate(${t.rotation_deg})`;
  }

  half(t: SeatingTable): { hw: number; hd: number } {
    return { hw: t.width_cm / 2, hd: t.depth_cm / 2 };
  }

  capsuleTablePathFor(t: SeatingTable): string {
    return capsuleTablePathD(t.width_cm, t.depth_cm);
  }

  private validTableColorHex(t: SeatingTable): string | null {
    const c = t.color?.trim();
    if (!c || !/^#[0-9A-Fa-f]{6}$/.test(c)) return null;
    return c.toLowerCase();
  }

  /** Couleur personnalisée du plateau (null = styles CSS par défaut). */
  tableShapeFill(t: SeatingTable): string | undefined {
    const hex = this.validTableColorHex(t);
    if (!hex) return undefined;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.52)`;
  }

  tableShapeStroke(t: SeatingTable): string | undefined {
    const hex = this.validTableColorHex(t);
    if (!hex) return undefined;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const k = 0.62;
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
  }

  chairsForTable(t: SeatingTable): { x: number; y: number }[] {
    const n = (this.assignmentsByTable().get(t.id) ?? []).length;
    return chairPositionsForTable(t.shape, t.center_x_cm, t.center_y_cm, t.width_cm, t.depth_cm, t.rotation_deg, n);
  }

  chairMarkersForTable(t: SeatingTable): {
    x: number;
    y: number;
    initials: string;
    personneId: number | null;
    tableId: number;
  }[] {
    const positions = this.chairsForTable(t);
    const assigns = this.assignmentsByTable().get(t.id) ?? [];
    const byId = this.personneById();
    return positions.map((p, i) => {
      const a = assigns[i];
      const pers = a ? byId.get(a.personne_id) : undefined;
      return {
        x: p.x,
        y: p.y,
        initials: pers ? this.initials(pers) : '',
        personneId: a?.personne_id ?? null,
        tableId: t.id,
      };
    });
  }

  private familleBlockTitle(p: PersonneRepasRow, byId: Map<number, PersonneRepasRow>): string {
    const f = Array.isArray(p.familles) ? p.familles[0] : p.familles;
    const pid = f?.personne_principale;
    if (pid != null) {
      const pr = byId.get(pid);
      if (pr) return `${pr.prenom} ${pr.nom}`;
    }
    return p.famille_id != null ? `Famille #${p.famille_id}` : 'Sans famille';
  }

  displayPersonne(p: PersonneRepasRow): string {
    const line = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();
    return line || `Personne #${p.id}`;
  }

  /** Titre de table pour la liste mobile (index 1-based dans l’ordre trié). */
  mobileTableListTitle(t: SeatingTable, indexInSortedList: number): string {
    return t.label?.trim()
      ? `Table « ${t.label} »`
      : `Table ${indexInSortedList + 1} (${t.shape})`;
  }

  initials(p: PersonneRepasRow): string {
    return ((p.prenom?.[0] ?? '') + (p.nom?.[0] ?? '')).toUpperCase();
  }

  clientToCm(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = this.planCanvas()?.getSvgElement();
    if (!el) return null;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = el.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  private applySnap(x: number, y: number): { x: number; y: number } {
    if (!this.snapEnabled()) return { x: Math.round(x), y: Math.round(y) };
    const s = this.gridStepCm();
    return { x: snapCm(x, s), y: snapCm(y, s) };
  }

  toggleGridVisibility() {
    this.gridVisible.update((v) => !v);
  }

  toggleSnapEnabled() {
    if (this.readonlyLayout()) return;
    this.snapEnabled.update((v) => !v);
  }

  toggleCoordinateProbe() {
    this.setCoordinateProbeEnabled(!this.coordinateProbeEnabled());
  }

  setCoordinateProbeEnabled(on: boolean) {
    this.coordinateProbeEnabled.set(on);
    if (!on) this.probeSnappedCm.set(null);
    else {
      this.measureToolEnabled.set(false);
      this.measureOriginCm.set(null);
      this.measureCursorCm.set(null);
    }
  }

  toggleMeasureTool() {
    this.setMeasureToolEnabled(!this.measureToolEnabled());
  }

  setMeasureToolEnabled(on: boolean) {
    this.measureToolEnabled.set(on);
    if (!on) {
      this.measureOriginCm.set(null);
      this.measureCursorCm.set(null);
    } else {
      this.coordinateProbeEnabled.set(false);
      this.probeSnappedCm.set(null);
    }
  }

  measureToolTooltip =
    'Mesure : 1er clic pose l’origine, la distance s’affiche près du curseur (magnétisme comme le plan), 2ᵉ clic efface.';

  /**
   * Sous-groupe en « unités écran » : translate au point (cm) puis scale(1/pxPerCm) pour que r=5 et font 11
   * restent ~5 px et ~11 px quel que soit le zoom (évite les rayons minuscules ou énormes en cm SVG).
   */
  probeScreenGroupTransform(pr: { x: number; y: number }): string {
    const px = this.effectivePxPerCm();
    if (px <= 1e-9) return `translate(${pr.x},${pr.y})`;
    const k = 1 / px;
    return `translate(${pr.x},${pr.y}) scale(${k})`;
  }

  onViewportProbeMove(ev: MouseEvent) {
    const v = this.venue();
    if (v && this.mode() === 'room') {
      if (this.roomAccordionSection() === 'windows') {
        this.updateWindowPlacementPreview(ev.clientX, ev.clientY);
      }
      if (this.roomAccordionSection() === 'doors') {
        this.refreshDoorPlacementPreview(ev.clientX, ev.clientY);
      }
      if (this.roomAccordionSection() === 'freeforms') {
        this.updateFreeformRubber(ev.clientX, ev.clientY);
      }
    }
    if (v && this.measureToolEnabled() && this.measureOriginCm() != null) {
      const cmM = this.clientToCm(ev.clientX, ev.clientY);
      if (cmM) {
        const snappedM = this.applySnap(cmM.x, cmM.y);
        const mx = Math.max(0, Math.min(v.room_width_cm, snappedM.x));
        const my = Math.max(0, Math.min(v.room_height_cm, snappedM.y));
        this.measureCursorCm.set({ x: mx, y: my });
      }
    }

    if (!this.coordinateProbeEnabled()) return;
    if (!v) return;
    const cm = this.clientToCm(ev.clientX, ev.clientY);
    if (!cm) return;
    const snapped = this.applySnap(cm.x, cm.y);
    const sx = Math.max(0, Math.min(v.room_width_cm, snapped.x));
    const sy = Math.max(0, Math.min(v.room_height_cm, snapped.y));
    this.probeSnappedCm.set({ x: sx, y: sy });
  }

  onViewportProbeLeave() {
    if (this.measureToolEnabled() && this.measureOriginCm() != null) {
      this.measureCursorCm.set(null);
    }
    if (this.coordinateProbeEnabled()) this.probeSnappedCm.set(null);
    this.windowPlacementPreview.set(null);
    this.doorPlacementPreview.set(null);
    this.freeformRubberEndCm.set(null);
  }

  async onSvgClick(ev: MouseEvent) {
    const v = this.venue();
    if (!v) return;

    if (this.measureToolEnabled()) {
      ev.preventDefault();
      this.clearAssignTableClickTimer();
      const cm = this.clientToCm(ev.clientX, ev.clientY);
      if (!cm) return;
      const snapped = this.applySnap(cm.x, cm.y);
      const sx = Math.max(0, Math.min(v.room_width_cm, snapped.x));
      const sy = Math.max(0, Math.min(v.room_height_cm, snapped.y));
      if (this.measureOriginCm() == null) {
        this.measureOriginCm.set({ x: sx, y: sy });
        this.measureCursorCm.set({ x: sx, y: sy });
      } else {
        this.measureOriginCm.set(null);
        this.measureCursorCm.set(null);
      }
      return;
    }

    if (this.readonlyLayout()) return;

    if (this.mode() === 'room') {
      const sec = this.roomAccordionSection();
      if (sec === 'doors') {
        const cmDoors = this.clientToCm(ev.clientX, ev.clientY);
        if (!cmDoors) return;
        await this.tryPlaceDoorFromClick(cmDoors.x, cmDoors.y, ev.clientX, ev.clientY);
        return;
      }
      if (sec === 'freeforms') {
        const cmF = this.clientToCm(ev.clientX, ev.clientY);
        if (!cmF) return;
        this.handleFreeformSvgClick(cmF.x, cmF.y);
        return;
      }
      const cm = this.clientToCm(ev.clientX, ev.clientY);
      if (!cm) return;
      if (sec === 'windows') {
        await this.tryPlaceWindowFromClick(cm.x, cm.y);
        return;
      }
      if (sec !== 'walls') return;
      const draft = this.wallDraft();
      const snapped = this.applySnap(cm.x, cm.y);
      const sx = Math.max(0, Math.min(v.room_width_cm, snapped.x));
      const sy = Math.max(0, Math.min(v.room_height_cm, snapped.y));
      if (!draft) {
        const t = this.clampWallThicknessCm(this.wallNewThicknessCm);
        this.wallDraft.set({ x: sx, y: sy, thickness_cm: t });
        this.wallDraftEndPreview.set({ x: sx, y: sy });
        return;
      }
      /* Aligner le 2ᵉ point sur l’aperçu (dernière position magnétisée) pour éviter écarts clic / filigrane. */
      this.updateWallDraftPreviewFromClient(ev.clientX, ev.clientY);
      const pr = this.wallDraftEndPreview();
      const x2 = pr?.x ?? sx;
      const y2 = pr?.y ?? sy;
      const ok = await this.finishWallSegment(draft.x, draft.y, x2, y2, draft.thickness_cm);
      if (ok) {
        this.wallDraft.set(null);
        this.wallDraftEndPreview.set(null);
      }
      return;
    }

    const cm = this.clientToCm(ev.clientX, ev.clientY);
    if (!cm) return;
    if (this.mode() === 'tables') {
      const hit = findTableAtPoint(cm.x, cm.y, this.tables());
      if (hit != null) this.selectTable(hit);
      else this.selectedTableId.set(null);
      return;
    }
    if (this.mode() === 'assign') {
      if (performance.now() < this.assignTableDialogSuppressUntilMs) {
        ev.preventDefault();
        ev.stopPropagation();
        this.clearAssignTableClickTimer();
        return;
      }
      const hit = findTableAtPoint(cm.x, cm.y, this.tables());
      if (hit == null) return;
      this.clearAssignTableClickTimer();
      this.assignTableClickTimer = setTimeout(() => {
        this.assignTableClickTimer = null;
        this.openTableGuestsDialog(hit);
      }, 280);
    }
  }

  onSvgDblClick(ev: MouseEvent) {
    if (this.measureToolEnabled()) {
      ev.preventDefault();
      return;
    }
    if (this.readonlyLayout() || this.mode() !== 'assign') return;
    ev.preventDefault();
    this.clearAssignTableClickTimer();
    const cm = this.clientToCm(ev.clientX, ev.clientY);
    if (!cm) return;
    const hit = findTableAtPoint(cm.x, cm.y, this.tables());
    if (hit != null) this.selectTable(hit);
  }

  private clearAssignTableClickTimer() {
    if (this.assignTableClickTimer != null) {
      clearTimeout(this.assignTableClickTimer);
      this.assignTableClickTimer = null;
    }
  }

  private suppressAssignTableDialogBrieflyAfterPersonDrag(): void {
    this.assignTableDialogSuppressUntilMs = performance.now() + 550;
  }

  private openTableGuestsDialog(tableId: number) {
    const vid = this.selectedVariantId();
    const table = this.tables().find((t) => t.id === tableId);
    const assigns = [...(this.assignmentsByTable().get(tableId) ?? [])].sort((a, b) => a.seat_order - b.seat_order);
    if (!table || vid == null) return;
    const label = table.label?.trim() ? table.label.trim() : `Table ${tableId}`;
    const byId = this.personneById();
    type Row = { personneId: number; familleId: number; line: string };
    const rows: Row[] = [];
    for (const a of assigns) {
      const p = byId.get(a.personne_id);
      if (!p) {
        rows.push({ personneId: a.personne_id, familleId: -1, line: `Invité #${a.personne_id}` });
      } else {
        const line = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || `Personne #${p.id}`;
        rows.push({ personneId: p.id, familleId: p.famille_id ?? -1, line });
      }
    }
    const orderFam: number[] = [];
    const famMap = new Map<number, TableGuestMember[]>();
    for (const r of rows) {
      if (!famMap.has(r.familleId)) {
        famMap.set(r.familleId, []);
        orderFam.push(r.familleId);
      }
      famMap.get(r.familleId)!.push({ personneId: r.personneId, line: r.line });
    }
    const groups: TableGuestsFamilleGroup[] = orderFam.map((fid) => ({
      familleId: fid,
      members: famMap.get(fid)!,
    }));
    const ref = this.dialog.open(TableGuestsDialogComponent, {
      data: {
        tableId,
        tableLabel: label,
        initialLabel: table.label ?? '',
        initialColor: table.color ?? null,
        variantId: vid,
        readonlyLayout: this.readonlyLayout(),
        groups,
        refreshTables: async () => {
          const v = this.selectedVariantId();
          if (v != null) this.tables.set(await this.seating.getTables(v));
        },
      },
      width: 'min(420px, 92vw)',
      autoFocus: 'dialog',
    });
    ref.afterClosed().subscribe(async () => {
      const v = this.selectedVariantId();
      if (v == null) return;
      this.assignments.set(await this.seating.getAssignments(v));
      this.tables.set(await this.seating.getTables(v));
    });
  }

  setMode(m: PlanMode) {
    if (this.mode() === 'room' && m !== 'room') {
      this.wallDraft.set(null);
      this.wallDraftEndPreview.set(null);
      this.roomAccordionSection.set(null);
      this.hoveredWallId.set(null);
      this.hoveredWindowId.set(null);
      this.windowPlacementPreview.set(null);
      this.doorPlacementPreview.set(null);
      this.hoveredDoorId.set(null);
      this.freeformDraft.set(null);
      this.freeformRubberEndCm.set(null);
      this.hoveredFreeformId.set(null);
    }
    if (m !== 'assign') {
      this.clearAssignTableClickTimer();
      this.draggingPersonneId.set(null);
      this.personneDragOverlayCm.set(null);
      this.assignDropHighlightTableId.set(null);
      this.assignDropHighlightValid.set(false);
    }
    if (this.mode() === 'tables' && m !== 'tables') {
      const tid = this.draggingTableId();
      if (tid != null && !this.readonlyLayout()) {
        const t = this.tables().find((x) => x.id === tid);
        if (t) void this.seating.updateTable(tid, { center_x_cm: t.center_x_cm, center_y_cm: t.center_y_cm });
      }
      this.selectedTableId.set(null);
      this.draggingTableId.set(null);
      this.tableAxisLock = null;
    }
    if (m === 'assign') {
      this.gridVisible.set(false);
      this.snapEnabled.set(false);
    } else {
      this.gridVisible.set(true);
      this.snapEnabled.set(true);
    }
    this.mode.set(m);
  }

  async finishWallSegment(x1: number, y1: number, x2: number, y2: number, thickness_cm: number): Promise<boolean> {
    const v = this.venue();
    if (!v) return false;
    if (Math.hypot(x2 - x1, y2 - y1) < 1) {
      this.snack.open('Mur trop court : éloignez le 2ᵉ point du premier.', '', { duration: 2800 });
      return false;
    }
    const t = this.clampWallThicknessCm(thickness_cm);
    const seg = await this.seating.addWallSegment(v.id, x1, y1, x2, y2, t);
    if (!seg) {
      this.snack.open('Mur non enregistré (réseau ou colonne thickness_cm absente en base).', '', { duration: 4500 });
      return false;
    }
    this.walls.set([...this.walls(), seg]);
    return true;
  }

  onTableMouseDown(ev: MouseEvent, t: SeatingTable) {
    if (this.readonlyLayout() || this.mode() !== 'tables' || ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    this.selectTable(t.id);
    const cm = this.clientToCm(ev.clientX, ev.clientY);
    if (!cm) return;
    this.draggingTableId.set(t.id);
    this.dragTablePointerOffset = { x: cm.x - t.center_x_cm, y: cm.y - t.center_y_cm };
    this.tableDragFrozen = { x_cm: t.center_x_cm, y_cm: t.center_y_cm };
    this.tableAxisLock = null;
  }

  @HostListener('window:mousemove', ['$event'])
  onWinMove(ev: MouseEvent) {
    if (this.canvasPanning()) {
      let dx = ev.clientX - this.canvasPanLast.x;
      let dy = ev.clientY - this.canvasPanLast.y;
      if (ev.shiftKey) {
        if (this.canvasPanAxisLock == null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          this.canvasPanAxisLock = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        if (this.canvasPanAxisLock === 'h') dy = 0;
        else if (this.canvasPanAxisLock === 'v') dx = 0;
      } else {
        this.canvasPanAxisLock = null;
      }
      this.panX.update((p) => p + dx);
      this.panY.update((p) => p + dy);
      this.canvasPanLast = { x: ev.clientX, y: ev.clientY };
      return;
    }

    const tid = this.draggingTableId();
    if (tid != null) {
      const cm = this.clientToCm(ev.clientX, ev.clientY);
      if (!cm) return;
      let nx = cm.x - this.dragTablePointerOffset.x;
      let ny = cm.y - this.dragTablePointerOffset.y;
      let snapped = this.applySnap(nx, ny);
      if (ev.shiftKey) {
        if (this.tableAxisLock == null) {
          const ddx = snapped.x - this.tableDragFrozen.x_cm;
          const ddy = snapped.y - this.tableDragFrozen.y_cm;
          if (Math.hypot(ddx, ddy) > 12) {
            this.tableAxisLock = Math.abs(ddx) >= Math.abs(ddy) ? 'h' : 'v';
          }
        }
        if (this.tableAxisLock === 'h') snapped = { x: snapped.x, y: this.tableDragFrozen.y_cm };
        if (this.tableAxisLock === 'v') snapped = { x: this.tableDragFrozen.x_cm, y: snapped.y };
      } else {
        this.tableAxisLock = null;
      }
      this.tables.set(this.tables().map((t) => (t.id === tid ? { ...t, center_x_cm: snapped.x, center_y_cm: snapped.y } : t)));
      return;
    }

    const dragPid = this.draggingPersonneId();
    if (dragPid != null && this.mode() === 'assign') {
      const cm = this.clientToCm(ev.clientX, ev.clientY);
      if (cm) {
        this.personneDragOverlayCm.set({ x: cm.x, y: cm.y });
        const hit = findTableAtPoint(cm.x, cm.y, this.tables());
        if (hit == null) {
          this.assignDropHighlightTableId.set(null);
          this.assignDropHighlightValid.set(false);
        } else {
          const table = this.tables().find((x) => x.id === hit);
          const valid = table != null && this.canDropPersonneOnTable(dragPid, table);
          this.assignDropHighlightTableId.set(hit);
          this.assignDropHighlightValid.set(valid);
        }
      }
      return;
    }

    if (
      this.wallDraft() != null &&
      this.mode() === 'room' &&
      this.roomAccordionSection() === 'walls' &&
      !this.readonlyLayout()
    ) {
      this.updateWallDraftPreviewFromClient(ev.clientX, ev.clientY);
      return;
    }

    if (this.mode() === 'room' && !this.readonlyLayout()) {
      if (this.roomAccordionSection() === 'windows') {
        this.updateWindowPlacementPreview(ev.clientX, ev.clientY);
      } else if (this.windowPlacementPreview() != null) {
        this.windowPlacementPreview.set(null);
      }
      if (this.roomAccordionSection() === 'doors') {
        this.refreshDoorPlacementPreview(ev.clientX, ev.clientY);
      } else if (this.doorPlacementPreview() != null) {
        this.doorPlacementPreview.set(null);
      }
      if (this.roomAccordionSection() === 'freeforms') {
        this.updateFreeformRubber(ev.clientX, ev.clientY);
      } else {
        this.freeformRubberEndCm.set(null);
      }
    } else {
      if (this.windowPlacementPreview() != null) this.windowPlacementPreview.set(null);
      if (this.doorPlacementPreview() != null) this.doorPlacementPreview.set(null);
      this.freeformRubberEndCm.set(null);
    }
  }

  @HostListener('window:mouseup', ['$event'])
  async onWinUp(ev: MouseEvent) {
    if (this.canvasPanning()) {
      this.canvasPanning.set(false);
      this.canvasPanAxisLock = null;
      return;
    }

    const tid = this.draggingTableId();
    if (tid != null) {
      const t = this.tables().find((x) => x.id === tid);
      this.draggingTableId.set(null);
      this.tableAxisLock = null;
      if (t && !this.readonlyLayout()) {
        await this.seating.updateTable(tid, { center_x_cm: t.center_x_cm, center_y_cm: t.center_y_cm });
      }
      return;
    }

    const pid = this.draggingPersonneId();
    if (pid != null && !this.readonlyLayout() && this.mode() === 'assign') {
      this.clearAssignTableClickTimer();
      this.suppressAssignTableDialogBrieflyAfterPersonDrag();
      const cm = this.clientToCm(ev.clientX, ev.clientY);
      this.draggingPersonneId.set(null);
      this.personneDragOverlayCm.set(null);
      this.assignDropHighlightTableId.set(null);
      this.assignDropHighlightValid.set(false);
      if (!cm) return;
      const hitTid = findTableAtPoint(cm.x, cm.y, this.tables());
      const vid = this.selectedVariantId();
      if (hitTid == null || vid == null) return;
      const table = this.tables().find((t) => t.id === hitTid);
      if (!table) return;
      if (!this.canDropPersonneOnTable(pid, table)) {
        if ((this.assignmentsByTable().get(hitTid) ?? []).length >= table.max_chairs) {
          this.snack.open('Table pleine', '', { duration: 2500 });
        }
        return;
      }
      const curAsg = this.assignments().find((a) => a.personne_id === pid);
      if (curAsg && curAsg.table_id === hitTid) return;
      const already = curAsg != null;
      const ok = already
        ? await this.seating.movePersonToTable(vid, pid, hitTid)
        : await this.seating.assignPerson(vid, hitTid, pid);
      if (ok) {
        this.assignments.set(await this.seating.getAssignments(vid));
        this.selectedTableId.set(null);
      } else {
        this.snack.open(
          already ? 'Impossible de déplacer (table pleine ou erreur).' : 'Impossible d’assigner (déjà placé ou erreur)',
          '',
          { duration: 3000 },
        );
      }
    }
  }

  /**
   * Drop possible : table non pleine pour un nouvel arrivant, ou déplacement depuis une autre table,
   * ou dépôt sur la même table (no-op au relâchement).
   */
  private canDropPersonneOnTable(personneId: number, table: SeatingTable): boolean {
    const cur = this.assignments().find((a) => a.personne_id === personneId);
    if (cur != null && cur.table_id === table.id) return true;
    const n = (this.assignmentsByTable().get(table.id) ?? []).length;
    return n < table.max_chairs;
  }

  onChairMacaronMouseDown(
    ev: MouseEvent,
    m: { personneId: number | null; initials: string; x: number; y: number },
  ) {
    if (m.personneId == null || this.readonlyLayout() || this.mode() !== 'assign' || ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    this.clearAssignTableClickTimer();
    this.startDragPersonne(m.personneId, ev);
  }

  startDragPersonne(id: number, ev: MouseEvent) {
    if (this.readonlyLayout() || this.mode() !== 'assign') return;
    ev.preventDefault();
    this.draggingPersonneId.set(id);
    const cm = this.clientToCm(ev.clientX, ev.clientY);
    this.personneDragOverlayCm.set(cm ? { x: cm.x, y: cm.y } : null);
    this.assignDropHighlightTableId.set(null);
    this.assignDropHighlightValid.set(false);
  }

  async unassign(personneId: number) {
    const vid = this.selectedVariantId();
    if (vid == null || this.readonlyLayout()) return;
    const ok = await this.seating.unassignPerson(vid, personneId);
    if (ok) this.assignments.set(await this.seating.getAssignments(vid));
  }

  // --- Export PNG / PDF (logique détaillée : SeatingPlanExportService) ---

  async exportPng() {
    const v = this.venue();
    const svg = this.planCanvas()?.getSvgElement();
    const snap = this.buildExportSnapshot();
    if (!v || !svg || !snap) return;
    const raster = await this.seatingExport.rasterizePlanToPngDataUrl(svg, snap);
    if (!raster) {
      this.snack.open('Export PNG échoué (image de fond ou navigateur)', '', { duration: 4000 });
      return;
    }
    const a = document.createElement('a');
    a.download = `plan-de-table-${v.name.replace(/\s+/g, '-')}.png`;
    a.href = raster.dataUrl;
    a.click();
    this.snack.open('PNG exporté', '', { duration: 2000 });
  }

  async exportPdf() {
    const v = this.venue();
    const svg = this.planCanvas()?.getSvgElement();
    const snap = this.buildExportSnapshot();
    if (!v || !svg || !snap) return;
    try {
      const raster = await this.seatingExport.rasterizePlanToPngDataUrl(svg, snap, {
        macaronInitialsOnly: true,
      });
      if (!raster) {
        this.snack.open('Export PDF échoué', '', { duration: 4000 });
        return;
      }
      const pdf = this.seatingExport.buildPdfDocument(raster, snap);
      pdf.save(`plan-de-table-${v.name.replace(/\s+/g, '-')}.pdf`);
      this.snack.open('PDF exporté', '', { duration: 2000 });
    } catch {
      this.snack.open('Export PDF échoué', '', { duration: 4000 });
    }
  }

  /** Instantané cohérent pour l’export (évite décalage si l’état change pendant l’async). */
  private buildExportSnapshot(): SeatingExportSnapshot | null {
    const v = this.venue();
    if (!v) return null;
    return {
      venue: v,
      tables: this.tables(),
      assignmentsByTable: this.assignmentsByTable(),
      personneById: this.personneById(),
      displayPersonne: (p) => this.displayPersonne(p),
      variantName: this.selectedVariant()?.name ?? '—',
    };
  }
}
