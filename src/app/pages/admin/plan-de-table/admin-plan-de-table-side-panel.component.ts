import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { AdminPlanDeTableComponent } from './admin-plan-de-table.component';

/**
 * Panneau latéral : construction de la pièce, édition des tables, liste des invités.
 * Toute la logique métier reste sur {@link AdminPlanDeTableComponent}.
 */
@Component({
  selector: 'app-admin-plan-de-table-side-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatExpansionModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-plan-de-table-side-panel.component.html',
  styleUrls: ['./admin-plan-de-table-side-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlanDeTableSidePanelComponent {
  host = input.required<AdminPlanDeTableComponent>();
}
