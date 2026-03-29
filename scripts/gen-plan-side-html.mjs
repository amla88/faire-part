import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "src/app/pages/admin/plan-de-table/admin-plan-de-table.component.html");
const text = fs.readFileSync(p, "utf8");
const start = text.indexOf('      <aside class="side-panel">');
const end = text.indexOf("    </div>\n  </div>\n}") - 1; // before closing main-split - find </aside>
const asideEnd = text.indexOf("      </aside>", start) + "      </aside>".length;
const block = text.slice(start, asideEnd);
const lines = block.split(/\r?\n/);
const out = [];
out.push("@if (host(); as h) {");
out.push("  @if (h.venue(); as ven) {");
for (const line of lines) {
  if (!line.trim()) continue;
  const stripped = line.startsWith("      ") ? line.slice(6) : line;
  let s = "    " + stripped;
  const repl = [
    ["unassignedFilteredCount()", "h.unassignedFilteredCount()"],
    ["unassignedFamilleBlocks()", "h.unassignedFamilleBlocks()"],
    ["unassignedPersonnes()", "h.unassignedPersonnes()"],
    ["assignListSearch()", "h.assignListSearch()"],
    ["assignListSearch.set", "h.assignListSearch.set"],
    ["selectedVariant()", "h.selectedVariant()"],
    ["selectedTable()", "h.selectedTable()"],
    ["assignmentsByTable()", "h.assignmentsByTable()"],
    ["personneById()", "h.personneById()"],
    ["displayPersonne(", "h.displayPersonne("],
    ["startDragPersonne", "h.startDragPersonne"],
    ["draggingPersonneId()", "h.draggingPersonneId()"],
    ["unassign(", "h.unassign("],
    ["readonlyLayout()", "h.readonlyLayout()"],
    ["mode()", "h.mode()"],
    ["newTableShape", "h.newTableShape"],
    ["addTable()", "h.addTable()"],
    ["editTableLabel", "h.editTableLabel"],
    ["editTableWidth", "h.editTableWidth"],
    ["editTableDepth", "h.editTableDepth"],
    ["editTableMaxChairs", "h.editTableMaxChairs"],
    ["editTableRotation", "h.editTableRotation"],
    ["applyTableEdits()", "h.applyTableEdits()"],
    ["deleteSelectedTable()", "h.deleteSelectedTable()"],
    ["roomNameDraft", "h.roomNameDraft"],
    ["roomWidthDraft", "h.roomWidthDraft"],
    ["roomHeightDraft", "h.roomHeightDraft"],
    ["saveVenueBasics()", "h.saveVenueBasics()"],
    ["onBackgroundFile", "h.onBackgroundFile"],
    ["bgXDraft", "h.bgXDraft"],
    ["bgYDraft", "h.bgYDraft"],
    ["bgWDraft", "h.bgWDraft"],
    ["bgHDraft", "h.bgHDraft"],
    ["saveBackgroundPlacement()", "h.saveBackgroundPlacement()"],
    ["clearBackground()", "h.clearBackground()"],
    ["onRoomPanelOpened", "h.onRoomPanelOpened"],
    ["onRoomPanelClosed", "h.onRoomPanelClosed"],
    ["wallNewThicknessCm", "h.wallNewThicknessCm"],
    ["wallDraft()", "h.wallDraft()"],
    ["cancelWallDraft()", "h.cancelWallDraft()"],
    ["walls()", "h.walls()"],
    ["setHoveredWall", "h.setHoveredWall"],
    ["clearHoveredWall()", "h.clearHoveredWall()"],
    ["hoveredWallId()", "h.hoveredWallId()"],
    ["deleteWall(", "h.deleteWall("],
    ["wallStrokeCm(", "h.wallStrokeCm("],
    ["newWindowWidthCm", "h.newWindowWidthCm"],
    ["windows()", "h.windows()"],
    ["setHoveredWindow", "h.setHoveredWindow"],
    ["clearHoveredWindow()", "h.clearHoveredWindow()"],
    ["hoveredWindowId()", "h.hoveredWindowId()"],
    ["deleteWindow(", "h.deleteWindow("],
    ["windowSummary(", "h.windowSummary("],
    ["newDoorKind", "h.newDoorKind"],
    ["newDoorWidthCm", "h.newDoorWidthCm"],
    ["doors()", "h.doors()"],
    ["setHoveredDoor", "h.setHoveredDoor"],
    ["clearHoveredDoor()", "h.clearHoveredDoor()"],
    ["hoveredDoorId()", "h.hoveredDoorId()"],
    ["deleteDoor(", "h.deleteDoor("],
    ["doorSummary(", "h.doorSummary("],
    ["newFreeformStrokeWidthCm", "h.newFreeformStrokeWidthCm"],
    ["freeforms()", "h.freeforms()"],
    ["setHoveredFreeform", "h.setHoveredFreeform"],
    ["clearHoveredFreeform()", "h.clearHoveredFreeform()"],
    ["hoveredFreeformId()", "h.hoveredFreeformId()"],
    ["deleteFreeform(", "h.deleteFreeform("],
    ["freeformSummary(", "h.freeformSummary("],
  ];
  for (const [a, b] of repl) s = s.split(a).join(b);
  out.push(s);
}
out.push("  }");
out.push("}");
const outPath = path.join(root, "src/app/pages/admin/plan-de-table/admin-plan-de-table-side-panel.component.html");
fs.writeFileSync(outPath, out.join("\n") + "\n", "utf8");
console.log("written", out.length, "lines");
