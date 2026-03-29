import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "src/app/pages/admin/plan-de-table/admin-plan-de-table.component.html");
const text = fs.readFileSync(p, "utf8");
const start = text.indexOf('      <div class="canvas-panel">');
const end = text.indexOf('      <aside class="side-panel">');
const block = text.slice(start, end);
const lines = block.split(/\r?\n/);
const out = [];
out.push("@if (host(); as h) {");
out.push("  @if (h.venue(); as ven) {");
const repl = [
  ["effectivePxPerCm()", "h.effectivePxPerCm()"],
  ["gridStepDisplayLabel()", "h.gridStepDisplayLabel()"],
  ["assignDropHighlightValid()", "h.assignDropHighlightValid()"],
  ["assignDropHighlightTableId()", "h.assignDropHighlightTableId()"],
  ["coordinateProbeEnabled()", "h.coordinateProbeEnabled()"],
  ["personneDragOverlayCm()", "h.personneDragOverlayCm()"],
  ["draggingPersonneId()", "h.draggingPersonneId()"],
  ["measureToolEnabled()", "h.measureToolEnabled()"],
  ["measureCursorCm()", "h.measureCursorCm()"],
  ["measureOriginCm()", "h.measureOriginCm()"],
  ["measureHudLabel()", "h.measureHudLabel()"],
  ["probeSnappedCm()", "h.probeSnappedCm()"],
  ["coordProbeHudLabel()", "h.coordProbeHudLabel()"],
  ["personneById()", "h.personneById()"],
  ["readonlyLayout()", "h.readonlyLayout()"],
  ["chairMarkersForTable(t)", "h.chairMarkersForTable(t)"],
  ["onChairMacaronMouseDown", "h.onChairMacaronMouseDown"],
  ["chairMacaronRadiusCm", "h.chairMacaronRadiusCm"],
  ["probeScreenGroupTransform", "h.probeScreenGroupTransform"],
  ["initials(", "h.initials("],
  ["selectedTableId()", "h.selectedTableId()"],
  ["onTableMouseDown", "h.onTableMouseDown"],
  ["tableShapeStroke(", "h.tableShapeStroke("],
  ["tableShapeFill(", "h.tableShapeFill("],
  ["capsuleTablePathFor(", "h.capsuleTablePathFor("],
  ["half(", "h.half("],
  ["tableGroupTransform(", "h.tableGroupTransform("],
  ["freeformVertexHandleRCm()", "h.freeformVertexHandleRCm()"],
  ["freeformDraftRubberPathD()", "h.freeformDraftRubberPathD()"],
  ["freeformDraftOpenPathD()", "h.freeformDraftOpenPathD()"],
  ["freeformPolygonPathD(", "h.freeformPolygonPathD("],
  ["freeformStrokeWidthRender(", "h.freeformStrokeWidthRender("],
  ["hoveredFreeformId()", "h.hoveredFreeformId()"],
  ["freeforms()", "h.freeforms()"],
  ["freeformDraft()", "h.freeformDraft()"],
  ["hoveredDoorId()", "h.hoveredDoorId()"],
  ["doorPlanElementsForPlaced(", "h.doorPlanElementsForPlaced("],
  ["doorPlanElementsFromPreview()", "h.doorPlanElementsFromPreview()"],
  ["doorPlacementPreview()", "h.doorPlacementPreview()"],
  ["doors()", "h.doors()"],
  ["windowLineStrokeWidthCm(", "h.windowLineStrokeWidthCm("],
  ["windowEndpointsForRender(", "h.windowEndpointsForRender("],
  ["hoveredWindowId()", "h.hoveredWindowId()"],
  ["windows()", "h.windows()"],
  ["windowPlacementPreview()", "h.windowPlacementPreview()"],
  ["wallDraftEndPreview()", "h.wallDraftEndPreview()"],
  ["roomAccordionSection()", "h.roomAccordionSection()"],
  ["wallDraft()", "h.wallDraft()"],
  ["wallLineStrokeWidthCm(", "h.wallLineStrokeWidthCm("],
  ["hoveredWallId()", "h.hoveredWallId()"],
  ["walls()", "h.walls()"],
  ["outerWallRingPath()", "h.outerWallRingPath()"],
  ["gridFiligreeStrokeRing()", "h.gridFiligreeStrokeRing()"],
  ["gridFiligreeNodeR()", "h.gridFiligreeNodeR()"],
  ["gridFiligreeStrokeHook()", "h.gridFiligreeStrokeHook()"],
  ["gridFiligreeHooksD()", "h.gridFiligreeHooksD()"],
  ["gridFiligreeStrokeMain()", "h.gridFiligreeStrokeMain()"],
  ["gridFiligreeOutlineD()", "h.gridFiligreeOutlineD()"],
  ["gridStepCm()", "h.gridStepCm()"],
  ["gridVisible()", "h.gridVisible()"],
  ["floorSvgViewBox()", "h.floorSvgViewBox()"],
  ["onSvgDblClick", "h.onSvgDblClick"],
  ["onSvgClick", "h.onSvgClick"],
  ["panY()", "h.panY()"],
  ["panX()", "h.panX()"],
  ["perimeterWallCm", "h.perimeterWallCm"],
  ["scaleLegend()", "h.scaleLegend()"],
  ["onViewportProbeLeave()", "h.onViewportProbeLeave()"],
  ["onViewportProbeMove", "h.onViewportProbeMove"],
  ["onViewportContextMenu", "h.onViewportContextMenu"],
  ["onViewportPointerDown", "h.onViewportPointerDown"],
  ["canvasPanning()", "h.canvasPanning()"],
  ["mode()", "h.mode()"],
  ["tables()", "h.tables()"],
];
for (const line of lines) {
  if (line.trim() === '<div class="canvas-panel">') {
    out.push("    <div");
    out.push('      class="canvas-panel"');
    out.push(`      [class.mode-room]="h.mode() === 'room'"`);
    out.push(`      [class.mode-tables]="h.mode() === 'tables'"`);
    out.push(`      [class.mode-assign]="h.mode() === 'assign'"`);
    out.push("    >");
    continue;
  }
  if (!line.trim()) continue;
  const stripped = line.startsWith("      ") ? line.slice(6) : line;
  let s = "    " + stripped;
  for (const [a, b] of repl) s = s.split(a).join(b);
  out.push(s);
}
out.push("  }");
out.push("}");
const outPath = path.join(root, "src/app/pages/admin/plan-de-table/admin-plan-de-table-canvas.component.html");
fs.writeFileSync(outPath, out.join("\n") + "\n", "utf8");
console.log("written", out.length, "lines");
