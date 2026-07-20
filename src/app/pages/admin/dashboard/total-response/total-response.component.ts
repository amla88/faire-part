import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';
import { AdminAuthService } from 'src/app/services/admin-auth.service';

import {
  NgApexchartsModule,
  ApexChart,
  ApexPlotOptions,
  ApexLegend,
  ApexResponsive,
} from 'ng-apexcharts';

interface PersonneRow {
  famille_id: number;
  invite_reception: boolean;
  present_reception: boolean;
  invite_repas: boolean;
  present_repas: boolean;
  invite_soiree: boolean;
  present_soiree: boolean;
  invite_anniversaire: boolean;
  present_anniversaire: boolean;
}

function isTrue(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function pct(num: number, denom: number): number {
  return denom ? Math.round((num / denom) * 1000) / 10 : 0;
}

@Component({
  selector: 'app-total-response',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, MatCardModule],
  templateUrl: './total-response.component.html',
  styleUrls: ['./total-response.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotalResponseComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);
  private readonly adminAuth = inject(AdminAuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly chartReady = signal(false);
  readonly series = signal<number[]>([0, 0, 0, 0, 0]);
  readonly chartLabels = signal<string[]>([
    'Réception',
    'Repas',
    'Soirée',
    'Anniversaire',
    'Réponses vérifiées',
  ]);
  readonly legendOptions = signal<ApexLegend>({
    show: true,
    position: 'right',
    fontSize: '13px',
    offsetY: 20,
    itemMargin: { vertical: 8, horizontal: 8 },
  });
  readonly plotOptions = signal<ApexPlotOptions>({
    radialBar: {
      offsetY: 0,
      startAngle: 0,
      endAngle: 270,
      hollow: {
        margin: 5,
        size: '30%',
        background: 'transparent',
      },
      track: {
        margin: 6,
      },
      dataLabels: {
        name: {
          show: true,
          fontSize: '13px',
          fontWeight: 600,
          offsetY: -6,
        },
        value: {
          show: true,
          fontSize: '12px',
          offsetY: 4,
          formatter: (val: number) => `${val}%`,
        },
      },
    },
  });

  readonly chart: ApexChart = { height: 420, type: 'radialBar' };
  readonly colors = ['#1ab7ea', '#0084ff', '#39539E', '#E91E63', '#0077B5'];
  readonly responsive: ApexResponsive[] = [
    {
      breakpoint: 768,
      options: {
        chart: { height: 520 },
        legend: { position: 'bottom', offsetY: 0 },
      },
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.adminAuth.initialized;
    await this.loadStats();
  }

  private async loadStats(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.chartReady.set(false);

    try {
      const client = this.supabase.getClient();

      const [personnesRes, famillesRes] = await Promise.all([
        client
          .from('personnes')
          .select(
            'famille_id, invite_reception, present_reception, invite_repas, present_repas, invite_soiree, present_soiree, invite_anniversaire, present_anniversaire'
          ),
        client.from('familles').select('id, reponses_verifiees'),
      ]);

      if (personnesRes.error) throw personnesRes.error;
      if (famillesRes.error) throw famillesRes.error;

      const rows = (personnesRes.data || []) as PersonneRow[];
      const verifiedFamilleIds = new Set<number>(
        (famillesRes.data || [])
          .filter((f: { reponses_verifiees?: boolean }) => isTrue(f.reponses_verifiees))
          .map((f: { id: number }) => Number(f.id))
      );

      const isVerified = (r: PersonneRow): boolean => verifiedFamilleIds.has(Number(r.famille_id));

      const counts = rows.reduce(
        (acc, r) => {
          const verified = isVerified(r);
          const hasPresentReception = isTrue(r.present_reception);
          const hasPresentRepas = isTrue(r.present_repas);
          const hasPresentSoiree = isTrue(r.present_soiree);
          const hasPresentAnniversaire = isTrue(r.present_anniversaire);
          const hasPresentAny =
            hasPresentReception || hasPresentRepas || hasPresentSoiree || hasPresentAnniversaire;

          if (isTrue(r.invite_reception)) acc.inviteReception++;
          if (verified && hasPresentReception) acc.presentReception++;
          if (verified && isTrue(r.invite_reception) && !hasPresentReception) {
            acc.absentVerifiedReception++;
          }

          if (isTrue(r.invite_repas)) acc.inviteRepas++;
          if (verified && hasPresentRepas) acc.presentRepas++;
          if (verified && isTrue(r.invite_repas) && !hasPresentRepas) {
            acc.absentVerifiedRepas++;
          }

          if (isTrue(r.invite_soiree)) acc.inviteSoiree++;
          if (verified && hasPresentSoiree) acc.presentSoiree++;
          if (verified && isTrue(r.invite_soiree) && !hasPresentSoiree) {
            acc.absentVerifiedSoiree++;
          }

          if (isTrue(r.invite_anniversaire)) acc.inviteAnniversaire++;
          if (verified && hasPresentAnniversaire) acc.presentAnniversaire++;
          if (verified && isTrue(r.invite_anniversaire) && !hasPresentAnniversaire) {
            acc.absentVerifiedAnniversaire++;
          }

          if (verified) {
            acc.totalVerifiedPersons++;
            if (hasPresentAny) acc.totalVerifiedPresentAny++;
          }

          return acc;
        },
        {
          inviteReception: 0,
          presentReception: 0,
          absentVerifiedReception: 0,
          inviteRepas: 0,
          presentRepas: 0,
          absentVerifiedRepas: 0,
          inviteSoiree: 0,
          presentSoiree: 0,
          absentVerifiedSoiree: 0,
          inviteAnniversaire: 0,
          presentAnniversaire: 0,
          absentVerifiedAnniversaire: 0,
          totalVerifiedPresentAny: 0,
          totalVerifiedPersons: 0,
        }
      );

      const totalPersons = rows.length;
      const verifiedReception = counts.presentReception + counts.absentVerifiedReception;
      const verifiedRepas = counts.presentRepas + counts.absentVerifiedRepas;
      const verifiedSoiree = counts.presentSoiree + counts.absentVerifiedSoiree;
      const verifiedAnniversaire = counts.presentAnniversaire + counts.absentVerifiedAnniversaire;

      this.series.set([
        pct(verifiedReception, counts.inviteReception),
        pct(verifiedRepas, counts.inviteRepas),
        pct(verifiedSoiree, counts.inviteSoiree),
        pct(verifiedAnniversaire, counts.inviteAnniversaire),
        pct(counts.totalVerifiedPersons, totalPersons),
      ]);

      const shortLabels = ['Réception', 'Repas', 'Soirée', 'Anniversaire', 'Réponses vérifiées'];
      const detailLabels = [
        `Réception: ${counts.presentReception} prés. + ${counts.absentVerifiedReception} abs. vér. / ${counts.inviteReception}`,
        `Repas: ${counts.presentRepas} prés. + ${counts.absentVerifiedRepas} abs. vér. / ${counts.inviteRepas}`,
        `Soirée: ${counts.presentSoiree} prés. + ${counts.absentVerifiedSoiree} abs. vér. / ${counts.inviteSoiree}`,
        `Anniversaire: ${counts.presentAnniversaire} prés. + ${counts.absentVerifiedAnniversaire} abs. vér. / ${counts.inviteAnniversaire}`,
        `Réponses vérifiées: ${counts.totalVerifiedPersons} / ${totalPersons} (${counts.totalVerifiedPresentAny} présents)`,
      ];

      this.chartLabels.set(shortLabels);
      this.legendOptions.set({
        show: true,
        position: 'right',
        fontSize: '13px',
        offsetY: 20,
        itemMargin: { vertical: 8, horizontal: 8 },
        formatter: (_seriesName: string, opts: { seriesIndex: number }) =>
          detailLabels[opts.seriesIndex] ?? '',
      });

      this.chartReady.set(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de charger les statistiques.';
      console.error('[TotalResponse] loadStats', err);
      this.loadError.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
