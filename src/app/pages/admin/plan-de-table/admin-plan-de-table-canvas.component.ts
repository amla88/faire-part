import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import type { AdminPlanDeTableComponent } from './admin-plan-de-table.component';

/**
 * Viewport + SVG du plan (tables, murs, invités). Délègue toute la logique au parent via `host`.
 */
@Component({
  selector: 'app-admin-plan-de-table-canvas',
  standalone: true,
  templateUrl: './admin-plan-de-table-canvas.component.html',
  styleUrls: ['./admin-plan-de-table-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlanDeTableCanvasComponent {
  host = input.required<AdminPlanDeTableComponent>();

  viewportRef = viewChild<ElementRef<HTMLElement>>('viewportRef');
  floorSvg = viewChild<ElementRef<SVGSVGElement>>('floorSvg');

  getSvgElement(): SVGSVGElement | undefined {
    return this.floorSvg()?.nativeElement;
  }

  getViewportElement(): HTMLElement | undefined {
    return this.viewportRef()?.nativeElement;
  }
}
