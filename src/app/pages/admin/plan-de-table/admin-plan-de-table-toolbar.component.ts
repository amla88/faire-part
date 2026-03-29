import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeatingLayoutVariant } from 'src/app/services/seating-plan.service';
import type { PlanMode } from './admin-plan-de-table.types';

/**
 * Barre du plan de table : sur mobile (readonlyLayout) variante + PNG + PDF ; sinon barre complète.
 * Le parent garde l’état ; ce composant ne fait qu’émettre des intentions.
 */
@Component({
  selector: 'app-admin-plan-de-table-toolbar',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-plan-de-table-toolbar.component.html',
  styleUrls: ['./admin-plan-de-table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlanDeTableToolbarComponent {
  readonly readonlyLayout = input(false);
  readonly variants = input<SeatingLayoutVariant[]>([]);
  readonly selectedVariantId = input<number | null>(null);
  readonly mode = input<PlanMode>('assign');
  readonly gridVisible = input(false);
  readonly snapEnabled = input(false);
  readonly coordinateProbeEnabled = input(false);
  readonly measureToolEnabled = input(false);
  readonly zoomPercentLabel = input('100 %');
  readonly coordinateProbeTooltip = input('');
  readonly measureToolTooltip = input('');
  readonly assignSwapToolActive = input(false);
  readonly assignMoveAllToolActive = input(false);

  readonly variantChange = output<number>();
  readonly addVariant = output<void>();
  readonly copyVariant = output<void>();
  readonly deleteVariant = output<void>();
  readonly resetView = output<void>();
  readonly exportPng = output<void>();
  readonly exportPdf = output<void>();
  readonly modeChange = output<PlanMode>();
  readonly toggleGrid = output<void>();
  readonly toggleSnap = output<void>();
  readonly toggleCoordinateProbe = output<void>();
  readonly toggleMeasureTool = output<void>();
  readonly toggleAssignSwapTool = output<void>();
  readonly toggleAssignMoveAllTool = output<void>();
}
