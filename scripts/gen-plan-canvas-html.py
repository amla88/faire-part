from pathlib import Path

p = Path("src/app/pages/admin/plan-de-table/admin-plan-de-table.component.html")
text = p.read_text(encoding="utf-8")
start = text.index('      <div class="canvas-panel">')
end = text.index('      <aside class="side-panel">')
block = text[start:end]
lines = block.splitlines()
out = []
out.append("@if (host(); as h) {")
out.append("  @if (h.venue(); as ven) {")
for line in lines:
    if line.strip() == '<div class="canvas-panel">':
        out.append("    <div")
        out.append('      class="canvas-panel"')
        out.append('      [class.mode-room]="h.mode() === \'room\'"')
        out.append('      [class.mode-tables]="h.mode() === \'tables\'"')
        out.append('      [class.mode-assign]="h.mode() === \'assign\'"')
        out.append("    >")
        continue
    if not line.strip():
        continue
    stripped = line[6:] if line.startswith("      ") else line
    s = "    " + stripped
    repl = [
        ("effectivePxPerCm()", "h.effectivePxPerCm()"),
        ("gridStepDisplayLabel()", "h.gridStepDisplayLabel()"),
        ("assignDropHighlightValid()", "h.assignDropHighlightValid()"),
        ("assignDropHighlightTableId()", "h.assignDropHighlightTableId()"),
        ("coordinateProbeEnabled()", "h.coordinateProbeEnabled()"),
        ("personneDragOverlayCm()", "h.personneDragOverlayCm()"),
        ("draggingPersonneId()", "h.draggingPersonneId()"),
        ("measureToolEnabled()", "h.measureToolEnabled()"),
        ("measureCursorCm()", "h.measureCursorCm()"),
        ("measureOriginCm()", "h.measureOriginCm()"),
        ("measureHudLabel()", "h.measureHudLabel()"),
        ("probeSnappedCm()", "h.probeSnappedCm()"),
        ("coordProbeHudLabel()", "h.coordProbeHudLabel()"),
        ("personneById()", "h.personneById()"),
        ("readonlyLayout()", "h.readonlyLayout()"),
        ("chairMarkersForTable(t)", "h.chairMarkersForTable(t)"),
        ("onChairMacaronMouseDown", "h.onChairMacaronMouseDown"),
        ("chairMacaronRadiusCm", "h.chairMacaronRadiusCm"),
        ("probeScreenGroupTransform", "h.probeScreenGroupTransform"),
        ("initials(", "h.initials("),
        ("selectedTableId()", "h.selectedTableId()"),
        ("onTableMouseDown", "h.onTableMouseDown"),
        ("tableShapeStroke(", "h.tableShapeStroke("),
        ("tableShapeFill(", "h.tableShapeFill("),
        ("capsuleTablePathFor(", "h.capsuleTablePathFor("),
        ("half(", "h.half("),
        ("tableGroupTransform(", "h.tableGroupTransform("),
        ("freeformVertexHandleRCm()", "h.freeformVertexHandleRCm()"),
        ("freeformDraftRubberPathD()", "h.freeformDraftRubberPathD()"),
        ("freeformDraftOpenPathD()", "h.freeformDraftOpenPathD()"),
        ("freeformPolygonPathD(", "h.freeformPolygonPathD("),
        ("freeformStrokeWidthRender(", "h.freeformStrokeWidthRender("),
        ("hoveredFreeformId()", "h.hoveredFreeformId()"),
        ("freeforms()", "h.freeforms()"),
        ("freeformDraft()", "h.freeformDraft()"),
        ("hoveredDoorId()", "h.hoveredDoorId()"),
        ("doorPlanElementsForPlaced(", "h.doorPlanElementsForPlaced("),
        ("doorPlanElementsFromPreview()", "h.doorPlanElementsFromPreview()"),
        ("doorPlacementPreview()", "h.doorPlacementPreview()"),
        ("doors()", "h.doors()"),
        ("windowLineStrokeWidthCm(", "h.windowLineStrokeWidthCm("),
        ("windowEndpointsForRender(", "h.windowEndpointsForRender("),
        ("hoveredWindowId()", "h.hoveredWindowId()"),
        ("windows()", "h.windows()"),
        ("windowPlacementPreview()", "h.windowPlacementPreview()"),
        ("wallDraftEndPreview()", "h.wallDraftEndPreview()"),
        ("roomAccordionSection()", "h.roomAccordionSection()"),
        ("wallDraft()", "h.wallDraft()"),
        ("wallLineStrokeWidthCm(", "h.wallLineStrokeWidthCm("),
        ("hoveredWallId()", "h.hoveredWallId()"),
        ("walls()", "h.walls()"),
        ("outerWallRingPath()", "h.outerWallRingPath()"),
        ("gridFiligreeStrokeRing()", "h.gridFiligreeStrokeRing()"),
        ("gridFiligreeNodeR()", "h.gridFiligreeNodeR()"),
        ("gridFiligreeStrokeHook()", "h.gridFiligreeStrokeHook()"),
        ("gridFiligreeHooksD()", "h.gridFiligreeHooksD()"),
        ("gridFiligreeStrokeMain()", "h.gridFiligreeStrokeMain()"),
        ("gridFiligreeOutlineD()", "h.gridFiligreeOutlineD()"),
        ("gridStepCm()", "h.gridStepCm()"),
        ("gridVisible()", "h.gridVisible()"),
        ("floorSvgViewBox()", "h.floorSvgViewBox()"),
        ("onSvgDblClick", "h.onSvgDblClick"),
        ("onSvgClick", "h.onSvgClick"),
        ("panY()", "h.panY()"),
        ("panX()", "h.panX()"),
        ("perimeterWallCm", "h.perimeterWallCm"),
        ("scaleLegend()", "h.scaleLegend()"),
        ("onViewportProbeLeave()", "h.onViewportProbeLeave()"),
        ("onViewportProbeMove", "h.onViewportProbeMove"),
        ("onViewportContextMenu", "h.onViewportContextMenu"),
        ("onViewportPointerDown", "h.onViewportPointerDown"),
        ("canvasPanning()", "h.canvasPanning()"),
        ("mode()", "h.mode()"),
        ("tables()", "h.tables()"),
    ]
    for a, b in repl:
        s = s.replace(a, b)
    out.append(s)
out.append("  }")
out.append("}")
Path("src/app/pages/admin/plan-de-table/admin-plan-de-table-canvas.component.html").write_text(
    "\n".join(out) + "\n", encoding="utf-8"
)
print("written", len(out), "lines")
