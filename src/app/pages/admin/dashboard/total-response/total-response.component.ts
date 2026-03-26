import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgSupabaseService } from '../../../../services/ng-supabase.service';

import {
  NgApexchartsModule,
  ApexChart,
  ApexPlotOptions,
  ApexNonAxisChartSeries,
  ApexLegend,
  ApexResponsive
} from 'ng-apexcharts';

@Component({
  selector: 'app-total-response',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, MatCardModule],
  templateUrl: './total-response.component.html',
  styleUrls: ['./total-response.component.scss'],
})
export class TotalResponseComponent implements OnInit {
  private supabase = inject(NgSupabaseService);

  // signal for dynamic series values (présents Réception, Repas, Soirée, totalPresentAny)
  series: WritableSignal<number[]> = signal([0, 0, 0, 0]);
  totalPersons = 0;
  // keep raw counts to show value/total in labels
  inviteReceptionCount = 0;
  inviteRepasCount = 0;
  inviteSoireeCount = 0;
  presentReceptionCount = 0;
  presentRepasCount = 0;
  presentSoireeCount = 0;
  totalPresentAnyCount = 0;

  chartOptions: ChartOptions = {
    chart: {
      height: 390,
      type: 'radialBar',
    },
    plotOptions: {
      radialBar: {
        offsetY: 0,
        startAngle: 0,
        endAngle: 270,
        hollow: {
          margin: 5,
          size: '30%',
          background: 'transparent',
          image: undefined,
        },
        dataLabels: {
          name: {
            show: true,
          },
          value: {
            show: true,
          }
        },
        barLabels: {
          enabled: true,
          useSeriesColors: true,
          offsetX: -8,
          fontSize: '16px',
          formatter: function(seriesName, opts) {
            return seriesName + ":  " + opts.w.globals.series[opts.seriesIndex]
          },
        },
      }
    },
  colors: ['#1ab7ea', '#0084ff', '#39539E', '#0077B5'],
    labels: ['Réception', 'Repas', 'Soirée', 'Réponses Totales'],
    responsive: [{
      breakpoint: 480,
      options: {
        legend: {
            show: false
        }
      }
    }]
  };

  async ngOnInit(): Promise<void> {
    // Récupérer les données depuis la table `personnes` et calculer les totaux
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('personnes')
        .select('invite_reception, present_reception, invite_repas, present_repas, invite_soiree, present_soiree');

      if (error) {
        console.warn('Erreur Supabase fetch personnes:', error);
        return;
      }

      const rows = (data || []) as Array<any>;

      // helper utils
      const isTrue = (v: any) => v === true || v === 'true' || v === 1 || v === '1';
      const pct = (num: number, denom: number) => denom ? Math.round((num / denom) * 1000) / 10 : 0; // 1 decimal

      // accumulate all counts in a single pass for clarity and performance
      const counts = rows.reduce((acc, r) => {
        const hasPresentReception = isTrue(r.present_reception);
        const hasPresentRepas = isTrue(r.present_repas);
        const hasPresentSoiree = isTrue(r.present_soiree);

        if (isTrue(r.invite_reception)) acc.inviteReception++;
        if (hasPresentReception) acc.presentReception++;

        if (isTrue(r.invite_repas)) acc.inviteRepas++;
        if (hasPresentRepas) acc.presentRepas++;

        if (isTrue(r.invite_soiree)) acc.inviteSoiree++;
        if (hasPresentSoiree) acc.presentSoiree++;

        if (hasPresentReception || hasPresentRepas || hasPresentSoiree) acc.totalPresentAny++;

        return acc;
      }, {
        inviteReception: 0,
        presentReception: 0,
        inviteRepas: 0,
        presentRepas: 0,
        inviteSoiree: 0,
        presentSoiree: 0,
        totalPresentAny: 0
      } as any);

      const totalPersons = rows.length;

      // expose raw counts for use in label formatter
      this.inviteReceptionCount = counts.inviteReception;
      this.presentReceptionCount = counts.presentReception;
      this.inviteRepasCount = counts.inviteRepas;
      this.presentRepasCount = counts.presentRepas;
      this.inviteSoireeCount = counts.inviteSoiree;
      this.presentSoireeCount = counts.presentSoiree;
      this.totalPresentAnyCount = counts.totalPresentAny;
      this.totalPersons = totalPersons;

      // set series as percentages (chart renders proportions)
      this.series.set([
        pct(counts.presentReception, counts.inviteReception),
        pct(counts.presentRepas, counts.inviteRepas),
        pct(counts.presentSoiree, counts.inviteSoiree),
        pct(counts.totalPresentAny, totalPersons)
      ]);

      // update barLabels formatter to show "present / invite" for each segment
      const existingBarLabels = (this.chartOptions.plotOptions && this.chartOptions.plotOptions.radialBar && this.chartOptions.plotOptions.radialBar.barLabels) || {};
      const newBarLabels = {
        ...existingBarLabels,
        formatter: (_seriesName: any, opts: any) => {
          const idx = opts.seriesIndex;
          if (idx === 0) return `Réception: ${this.presentReceptionCount} / ${this.inviteReceptionCount}`;
          if (idx === 1) return `Repas: ${this.presentRepasCount} / ${this.inviteRepasCount}`;
          if (idx === 2) return `Soirée: ${this.presentSoireeCount} / ${this.inviteSoireeCount}`;
          return `Réponses Totales: ${this.totalPresentAnyCount} / ${this.totalPersons}`;
        }
      };

      this.chartOptions = {
        ...this.chartOptions,
        plotOptions: {
          ...this.chartOptions.plotOptions,
          radialBar: {
            ...this.chartOptions.plotOptions.radialBar,
            barLabels: newBarLabels
          }
        }
      };

    } catch (err) {
      console.error('Erreur lors de la récupération des personnes :', err);
    }
  }

}

export type ChartOptions = {
  series?: ApexNonAxisChartSeries;
  chart: ApexChart;
  plotOptions: ApexPlotOptions;
  labels: string[];
  colors?: string[];
  responsive?: ApexResponsive[];
  legend?: ApexLegend;
};
