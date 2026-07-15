import { ChangeDetectionStrategy, Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';

export interface EditFamilleReponsesPerson {
  id: number;
  nom: string;
  prenom: string;
  invite_reception: boolean;
  present_reception: boolean;
  invite_repas: boolean;
  present_repas: boolean;
  invite_soiree: boolean;
  present_soiree: boolean;
  invite_anniversaire: boolean;
  present_anniversaire: boolean;
  decline_invitation: boolean;
}

export interface EditFamilleReponsesDialogData {
  familyName: string;
  personnes: EditFamilleReponsesPerson[];
  onUpdated?: (personnes: EditFamilleReponsesPerson[]) => void;
}

type PresenceField =
  | 'present_reception'
  | 'present_repas'
  | 'present_soiree'
  | 'present_anniversaire';

interface MomentConfig {
  label: string;
  inviteKey: keyof EditFamilleReponsesPerson;
  presentKey: PresenceField;
}

const MOMENTS: MomentConfig[] = [
  { label: 'Réception', inviteKey: 'invite_reception', presentKey: 'present_reception' },
  { label: 'Repas', inviteKey: 'invite_repas', presentKey: 'present_repas' },
  { label: 'Soirée', inviteKey: 'invite_soiree', presentKey: 'present_soiree' },
  { label: 'Anniversaire', inviteKey: 'invite_anniversaire', presentKey: 'present_anniversaire' },
];

@Component({
  selector: 'app-edit-famille-reponses-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Modifier les réponses</h2>
    <p class="dialog-subtitle">{{ data.familyName }}</p>

    <mat-dialog-content class="edit-reponses-content">
      <p class="dialog-hint">
        Chaque changement est enregistré immédiatement.
      </p>

      @for (person of personnes(); track person.id) {
        <section class="person-block">
          <h3 class="person-name">{{ person.prenom }} {{ person.nom }}</h3>

          @if (person.decline_invitation) {
            <p class="declined-notice">Invitation refusée pour cette personne.</p>
          }

          <div class="moments-list">
            @for (m of momentsForPerson(person); track m.presentKey) {
              <div class="moment-row" [class.moment-row--saving]="isSaving(person.id, m.presentKey)">
                <span class="moment-label">{{ m.label }}</span>
                <div class="moment-toggle">
                  <span class="toggle-side" [class.toggle-side--active]="!person[m.presentKey]">Non</span>
                  <mat-slide-toggle
                    [checked]="!!person[m.presentKey]"
                    [disabled]="isSaving(person.id, m.presentKey) || person.decline_invitation"
                    (change)="onPresenceChange(person, m.presentKey, $event.checked)"
                    [attr.aria-label]="m.label + ' : ' + (person[m.presentKey] ? 'présent' : 'absent')"
                  />
                  <span class="toggle-side" [class.toggle-side--active]="!!person[m.presentKey]">Oui</span>
                </div>
              </div>
            }
          </div>

          <div class="decline-row" [class.decline-row--saving]="isSaving(person.id, 'decline_invitation')">
            <span class="moment-label decline-label">Refuser l'invitation</span>
            <mat-slide-toggle
              [checked]="!!person.decline_invitation"
              [disabled]="isSaving(person.id, 'decline_invitation')"
              (change)="onDeclineChange(person, $event.checked)"
              aria-label="Refuser l'invitation"
            />
          </div>
        </section>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">Fermer</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-subtitle {
        margin: -8px 24px 0;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }

      .edit-reponses-content {
        min-width: min(480px, 92vw);
        max-height: 70vh;
        padding-top: 8px;
      }

      .dialog-hint {
        margin: 0 0 16px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.55);
      }

      .person-block {
        padding: 12px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .person-block:last-child {
        border-bottom: none;
      }

      .person-name {
        margin: 0 0 10px;
        font-size: 15px;
        font-weight: 600;
      }

      .declined-notice {
        margin: 0 0 10px;
        font-size: 12px;
        color: #6a1b9a;
      }

      .moments-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .moment-row,
      .decline-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .moment-row--saving,
      .decline-row--saving {
        opacity: 0.65;
      }

      .moment-label {
        font-size: 13px;
        font-weight: 500;
      }

      .decline-label {
        color: #c62828;
      }

      .moment-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .toggle-side {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
        min-width: 24px;
        text-align: center;
      }

      .toggle-side--active {
        color: rgba(0, 0, 0, 0.87);
        font-weight: 600;
      }

      .decline-row {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px dashed rgba(0, 0, 0, 0.08);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditFamilleReponsesDialogComponent implements OnInit {
  readonly moments = MOMENTS;
  readonly personnes = signal<EditFamilleReponsesPerson[]>([]);
  private readonly savingKeys = signal<Set<string>>(new Set());

  constructor(
    private readonly dialogRef: MatDialogRef<EditFamilleReponsesDialogComponent, EditFamilleReponsesPerson[] | undefined>,
    @Inject(MAT_DIALOG_DATA) readonly data: EditFamilleReponsesDialogData,
    private readonly ngSupabase: NgSupabaseService,
    private readonly snackBar: MatSnackBar
  ) {
    this.personnes.set(data.personnes.map((p) => ({ ...p })));
  }

  ngOnInit(): void {
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => this.close());
    this.dialogRef.keydownEvents().pipe(filter((e) => e.key === 'Escape')).subscribe(() => this.close());
  }

  momentsForPerson(person: EditFamilleReponsesPerson): MomentConfig[] {
    return MOMENTS.filter((m) => !!person[m.inviteKey]);
  }

  isSaving(personId: number, _field: PresenceField | 'decline_invitation'): boolean {
    return this.savingKeys().has(this.savingKey(personId));
  }

  async onPresenceChange(
    person: EditFamilleReponsesPerson,
    field: PresenceField,
    checked: boolean
  ): Promise<void> {
    if (person[field] === checked) return;
    const next: Partial<EditFamilleReponsesPerson> = {
      [field]: checked,
      decline_invitation: false,
    };
    await this.persistPerson(person.id, next);
  }

  async onDeclineChange(person: EditFamilleReponsesPerson, checked: boolean): Promise<void> {
    if (person.decline_invitation === checked) return;
    const next: Partial<EditFamilleReponsesPerson> = { decline_invitation: checked };
    if (checked) {
      next.present_reception = false;
      next.present_repas = false;
      next.present_soiree = false;
      next.present_anniversaire = false;
    }
    await this.persistPerson(person.id, next);
  }

  private async persistPerson(
    personId: number,
    patch: Partial<EditFamilleReponsesPerson>
  ): Promise<void> {
    const key = this.savingKey(personId);
    if (this.savingKeys().has(key)) return;

    this.setSaving(key, true);
    const previous = this.personnes().find((p) => p.id === personId);
    if (!previous) {
      this.setSaving(key, false);
      return;
    }

    const optimistic = { ...previous, ...patch };
    this.patchLocalPerson(optimistic);

    try {
      const client = this.ngSupabase.getClient();
      const payload: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === 'boolean') payload[k] = v;
      }
      const { error } = await client.from('personnes').update(payload).eq('id', personId);
      if (error) throw error;
      this.notifyUpdated();
    } catch (e: any) {
      this.patchLocalPerson(previous);
      this.snackBar.open(
        e?.message || 'Erreur lors de l’enregistrement',
        'Fermer',
        { duration: 5000 }
      );
    } finally {
      this.setSaving(key, false);
    }
  }

  private patchLocalPerson(updated: EditFamilleReponsesPerson): void {
    this.personnes.update((rows) => rows.map((p) => (p.id === updated.id ? { ...updated } : p)));
  }

  private savingKey(personId: number): string {
    return `${personId}`;
  }

  private setSaving(key: string, saving: boolean): void {
    this.savingKeys.update((set) => {
      const next = new Set(set);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  close(): void {
    this.notifyUpdated();
    this.dialogRef.close(this.personnes());
  }

  private notifyUpdated(): void {
    this.data.onUpdated?.(this.personnes().map((p) => ({ ...p })));
  }
}

export function toEditReponsesPerson(p: any): EditFamilleReponsesPerson {
  return {
    id: Number(p.id),
    nom: p.nom ?? '',
    prenom: p.prenom ?? '',
    invite_reception: !!p.invite_reception,
    present_reception: !!p.present_reception,
    invite_repas: !!p.invite_repas,
    present_repas: !!p.present_repas,
    invite_soiree: !!p.invite_soiree,
    present_soiree: !!p.present_soiree,
    invite_anniversaire: !!p.invite_anniversaire,
    present_anniversaire: !!p.present_anniversaire,
    decline_invitation: !!p.decline_invitation,
  };
}

export function patchPersonnesReponses(
  personnes: any[],
  updated: EditFamilleReponsesPerson[]
): any[] {
  const byId = new Map(updated.map((p) => [p.id, p]));
  return personnes.map((p) => {
    const u = byId.get(Number(p.id));
    if (!u) return p;
    return {
      ...p,
      present_reception: u.present_reception,
      present_repas: u.present_repas,
      present_soiree: u.present_soiree,
      present_anniversaire: u.present_anniversaire,
      decline_invitation: u.decline_invitation,
    };
  });
}
