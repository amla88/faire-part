import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeatingPlanService } from 'src/app/services/seating-plan.service';

export interface TableGuestMember {
  personneId: number;
  line: string;
}

export interface TableGuestsFamilleGroup {
  familleId: number;
  members: TableGuestMember[];
}

export interface TableGuestsDialogData {
  tableId: number;
  /** Libellé initial (affichage si lecture seule). */
  tableLabel: string;
  initialLabel: string;
  initialColor: string | null;
  variantId: number;
  readonlyLayout: boolean;
  groups: TableGuestsFamilleGroup[];
  refreshTables: () => Promise<void>;
}

function cloneGroups(g: TableGuestsFamilleGroup[]): TableGuestsFamilleGroup[] {
  return g.map((x) => ({ familleId: x.familleId, members: x.members.map((m) => ({ ...m })) }));
}

const COLOR_PRESETS = ['#e8b4b8', '#c5cae9', '#e1bee7', '#ffcc80', '#a5d6a7', '#90caf9', '#fff59d', '#bcaaa4'];

@Component({
  selector: 'app-table-guests-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title class="table-guests-dlg-heading">Table</h2>
    <mat-dialog-content class="table-guests-dialog-content">
      @if (!data.readonlyLayout) {
        <div class="table-meta-block">
          <mat-form-field appearance="outline" class="dlg-name-field" subscriptSizing="dynamic">
            <mat-label>Nom de la table</mat-label>
            <input matInput [(ngModel)]="labelModel" (blur)="saveTableMeta()" />
          </mat-form-field>
          <div class="color-block">
            <span class="color-block-label">Couleur du plateau</span>
            <div class="color-presets">
              <button
                type="button"
                class="color-swatch color-swatch--default"
                matTooltip="Couleur par défaut"
                [class.color-swatch--active]="colorHex === null"
                (click)="setColor(null)"
              ></button>
              @for (hex of colorPresets; track hex) {
                <button
                  type="button"
                  class="color-swatch"
                  [style.background]="hex"
                  [class.color-swatch--active]="colorHex === hex"
                  (click)="setColor(hex)"
                ></button>
              }
              <label class="color-native-wrap" matTooltip="Autre couleur">
                <input
                  type="color"
                  class="color-native-input"
                  [value]="colorPickerValue()"
                  (input)="onNativeColorPick($event)"
                />
                <span class="color-native-icon"><mat-icon>palette</mat-icon></span>
              </label>
            </div>
          </div>
        </div>
      } @else {
        <p class="readonly-table-name">{{ data.tableLabel }}</p>
      }

      <h3 class="guests-section-title">Invités</h3>
      @if (groups().length === 0) {
        <p class="empty-guests">Aucun invité à cette table pour l’instant.</p>
      } @else {
        <div class="table-guests-dialog-list">
          @for (g of groups(); track trackKey(g)) {
            @if (g.members.length > 1) {
              <div class="famille-frame">
                @for (m of g.members; track m.personneId) {
                  <div class="guest-row">
                    <span class="guest-line">{{ m.line }}</span>
                    @if (!data.readonlyLayout) {
                      <button
                        mat-icon-button
                        type="button"
                        class="guest-remove"
                        matTooltip="Retirer de la table"
                        [disabled]="removingId() === m.personneId"
                        (click)="removeMember(m.personneId)"
                      >
                        <mat-icon>person_remove</mat-icon>
                      </button>
                    }
                  </div>
                }
              </div>
            } @else {
              @for (m of g.members; track m.personneId) {
                <div class="guest-row guest-row--solo">
                  <span class="guest-line">{{ m.line }}</span>
                  @if (!data.readonlyLayout) {
                    <button
                      mat-icon-button
                      type="button"
                      class="guest-remove"
                      matTooltip="Retirer de la table"
                      [disabled]="removingId() === m.personneId"
                      (click)="removeMember(m.personneId)"
                    >
                      <mat-icon>person_remove</mat-icon>
                    </button>
                  }
                </div>
              }
            }
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close type="button">Fermer</button>
    </mat-dialog-actions>
  `,
  styles: `
    .table-guests-dlg-heading {
      margin-bottom: 0;
    }
    .table-meta-block {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .dlg-name-field {
      width: 100%;
    }
    .color-block {
      margin-top: 12px;
    }
    .color-block-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.55);
      margin-bottom: 8px;
    }
    .color-presets {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(0, 0, 0, 0.12);
      padding: 0;
      cursor: pointer;
      box-sizing: border-box;
    }
    .color-swatch--default {
      background: linear-gradient(135deg, #d4c4a8 50%, #f5f0e8 50%);
    }
    .color-swatch--active {
      border-color: #1976d2;
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.35);
    }
    .color-native-wrap {
      position: relative;
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 1px dashed rgba(0, 0, 0, 0.25);
    }
    .color-native-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }
    .color-native-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: rgba(0, 0, 0, 0.45);
    }
    .readonly-table-name {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
    }
    .guests-section-title {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.65);
    }
    .empty-guests {
      margin: 0;
      font-size: 14px;
      color: rgba(0, 0, 0, 0.5);
    }
    .table-guests-dialog-content {
      min-width: 280px;
      max-height: min(65vh, 480px);
      overflow: auto;
      padding-top: 8px;
    }
    .table-guests-dialog-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .famille-frame {
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 10px;
      padding: 6px 4px 6px 10px;
      background: rgba(0, 0, 0, 0.02);
    }
    .guest-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 44px;
      padding: 4px 0;
    }
    .guest-row--solo {
      padding-left: 4px;
      padding-right: 0;
    }
    .famille-frame .guest-row + .guest-row {
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    .guest-line {
      font-size: 14px;
      flex: 1;
      white-space: normal;
      word-break: break-word;
    }
    .guest-remove {
      flex-shrink: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGuestsDialogComponent implements OnInit {
  readonly data = inject<TableGuestsDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TableGuestsDialogComponent>);
  private readonly seating = inject(SeatingPlanService);

  readonly colorPresets = COLOR_PRESETS;

  groups = signal<TableGuestsFamilleGroup[]>(cloneGroups(this.data.groups));
  removingId = signal<number | null>(null);

  labelModel = '';
  /** null = thème par défaut */
  colorHex: string | null = null;

  ngOnInit() {
    this.labelModel = this.data.initialLabel ?? '';
    this.colorHex = this.normalizeHex(this.data.initialColor);
  }

  trackKey(g: TableGuestsFamilleGroup): string {
    return `${g.familleId}:${g.members.map((m) => m.personneId).join(',')}`;
  }

  colorPickerValue(): string {
    return this.colorHex ?? '#d4c4a8';
  }

  private normalizeHex(c: string | null | undefined): string | null {
    if (!c || typeof c !== 'string') return null;
    const t = c.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(t) ? t.toLowerCase() : null;
  }

  async setColor(hex: string | null) {
    this.colorHex = hex == null ? null : this.normalizeHex(hex);
    await this.saveTableMeta();
  }

  async onNativeColorPick(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.colorHex = this.normalizeHex(v);
    await this.saveTableMeta();
  }

  async saveTableMeta() {
    if (this.data.readonlyLayout) return;
    const label = this.labelModel.trim() === '' ? null : this.labelModel.trim();
    const ok = await this.seating.updateTable(this.data.tableId, {
      label,
      color: this.colorHex,
    });
    if (ok) await this.data.refreshTables();
  }

  async removeMember(personneId: number) {
    if (this.data.readonlyLayout) return;
    this.removingId.set(personneId);
    const ok = await this.seating.unassignPerson(this.data.variantId, personneId);
    this.removingId.set(null);
    if (!ok) return;
    this.groups.update((gs) => {
      const next = gs
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => m.personneId !== personneId),
        }))
        .filter((g) => g.members.length > 0);
      return next;
    });
    if (this.groups().length === 0) {
      this.ref.close();
    }
  }
}
