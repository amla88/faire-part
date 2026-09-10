import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, AppUser } from 'src/app/services/auth.service';
import { AvatarService } from 'src/app/services/avatar.service';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AvatarMacaronComponent } from 'src/app/shared/avatar-macaron/avatar-macaron.component';

export interface WeddingEventDef {
  key: 'reception' | 'repas' | 'soiree';
  presentField: 'present_reception' | 'present_repas' | 'present_soiree';
  time: string;
  title: string;
  subtitle: string;
}

export const WEDDING_DAY_EVENTS: WeddingEventDef[] = [
  {
    key: 'reception',
    presentField: 'present_reception',
    time: '11h30',
    title: 'L’ouverture du chapitre',
    subtitle: 'La réception',
  },
  {
    key: 'repas',
    presentField: 'present_repas',
    time: '15h',
    title: 'Le grand banquet',
    subtitle: 'Le repas',
  },
  {
    key: 'soiree',
    presentField: 'present_soiree',
    time: '20h',
    title: 'Le bal des légendes',
    subtitle: 'La soirée',
  },
];

export const WEDDING_VENUE = {
  name: 'La ferme aux chiens',
  street: 'rue des Fermes 3',
  city: '5081 Bovesse',
  country: 'Belgique',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('La ferme aux chiens, rue des Fermes 3, 5081 Bovesse, Belgique'),
};

export const WEDDING_OFFERING = {
  iban: 'BE87 0637 2432 4394',
  bic: 'GKCCBEBB',
};

export interface FamilyMemberYes {
  key: WeddingEventDef['key'];
  time: string;
  title: string;
  subtitle: string;
}

export interface FamilyMember {
  id: number;
  nom: string;
  prenom: string;
  displayName: string;
  declined: boolean;
  yesEvents: FamilyMemberYes[];
  imageSrc: string | null;
}

export interface ProgrammeItem extends WeddingEventDef {
  attendees: FamilyMember[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarMacaronComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly avatar = inject(AvatarService);
  private readonly supabase = inject(NgSupabaseService);

  readonly venue = WEDDING_VENUE;
  readonly offering = WEDDING_OFFERING;
  readonly events = WEDDING_DAY_EVENTS;

  readonly loading = signal(true);
  readonly selectedPersonName = signal('chers hôtes');
  readonly membres = signal<FamilyMember[]>([]);
  readonly ibanCopied = signal(false);
  private ibanCopiedTimer?: ReturnType<typeof setTimeout>;

  readonly programme = computed<ProgrammeItem[]>(() => {
    const people = this.membres();
    const items = this.events
      .map((ev) => ({
        ...ev,
        attendees: people.filter((p) => !p.declined && p.yesEvents.some((y) => y.key === ev.key)),
      }))
      .filter((item) => item.attendees.length > 0);
    return items;
  });

  readonly hasAnyPresence = computed(() => this.programme().length > 0);

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.applyGreeting(user);
    void this.ensureSelectedPerson(user);
    void this.loadFamille(user);
  }

  attendeeNames(item: ProgrammeItem): string {
    return item.attendees.map((p) => p.prenom).join(', ');
  }

  async copyIban(): Promise<void> {
    const value = `${this.offering.iban} — BIC ${this.offering.bic}`;
    try {
      await navigator.clipboard.writeText(value);
      this.ibanCopied.set(true);
      if (this.ibanCopiedTimer) clearTimeout(this.ibanCopiedTimer);
      this.ibanCopiedTimer = setTimeout(() => this.ibanCopied.set(false), 2200);
    } catch {
      this.ibanCopied.set(false);
    }
  }

  private applyGreeting(user: AppUser): void {
    const selectedId =
      user.selected_personne_id ??
      user.personne_principale_id ??
      (user.personnes?.length === 1 ? user.personnes[0].id : null);
    const personne = user.personnes?.find((p) => Number(p.id) === Number(selectedId)) ?? null;
    if (personne) {
      this.selectedPersonName.set(`${personne.prenom} ${personne.nom}`.trim());
    }
  }

  private async ensureSelectedPerson(user: AppUser): Promise<void> {
    if (user.selected_personne_id != null) {
      void this.avatar.loadAvatarFromRpc(Number(user.selected_personne_id));
      return;
    }
    const fallback =
      user.personne_principale_id ??
      (user.personnes?.length ? user.personnes[0].id : null);
    if (fallback != null) {
      await this.auth.selectPerson(Number(fallback));
    }
  }

  private isTrue(v: unknown): boolean {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  private async loadFamille(user: AppUser): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const rpcRes: { data?: unknown; error?: { message?: string } | null } = await client.rpc(
        'get_personnes_by_famille',
        { p_famille_id: user.famille_id },
      );
      if (rpcRes.error) {
        console.warn('Erreur Supabase rpc get_personnes_by_famille:', rpcRes.error);
        this.membres.set([]);
        return;
      }

      const rows: unknown[] = Array.isArray(rpcRes.data) ? rpcRes.data : [];
      const members: FamilyMember[] = rows.map((raw) => {
        const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const declined = this.isTrue(r['decline_invitation']);
        const yesEvents: FamilyMemberYes[] = declined
          ? []
          : this.events
              .filter((ev) => this.isTrue(r[ev.presentField]))
              .map((ev) => ({
                key: ev.key,
                time: ev.time,
                title: ev.title,
                subtitle: ev.subtitle,
              }));
        return {
          id: Number(r['id']),
          nom: String(r['nom'] ?? ''),
          prenom: String(r['prenom'] ?? ''),
          displayName: `${r['prenom'] ?? ''} ${r['nom'] ?? ''}`.trim(),
          declined,
          yesEvents,
          imageSrc: null,
        };
      });

      this.membres.set(members);

      const ids = members.map((p) => p.id).filter((n) => Number.isFinite(n));
      await Promise.all(ids.map((id) => this.avatar.loadAvatarFromRpc(id).catch(() => null)));

      this.membres.set(
        members.map((p) => {
          const raw = this.avatar.getAvatarDataUri(p.id);
          const s = raw != null ? String(raw).trim() : '';
          return { ...p, imageSrc: s.length > 0 ? s : null };
        }),
      );
    } catch (err) {
      console.error('Erreur lors de la récupération des personnes :', err);
      this.membres.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
