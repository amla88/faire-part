import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgSupabaseService } from 'src/app/services/ng-supabase.service';

@Component({
  selector: 'app-statistiques-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatProgressSpinnerModule],
  templateUrl: './statistiques-list.component.html',
  styleUrls: ['./statistiques-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatistiquesListComponent implements OnInit {
  private readonly supabase = inject(NgSupabaseService);

  readonly stats = signal<any[]>([]);
  readonly displayedColumns = signal<string[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  async ngOnInit() {
    try {
      const client = this.supabase.getClient();
      // On récupère toutes les données de la vue 'stats_rapides'
      const { data, error } = await client.from('stats_rapides').select('*');

      if (error) {
        this.error.set(error.message);
      } else if (data) {
        this.stats.set(data);
        if (data.length > 0) {
          // Extraction dynamique des noms de colonnes à partir du premier enregistrement
          this.displayedColumns.set(Object.keys(data[0]));
        }
      }
    } catch (err: any) {
      this.error.set(err.message || 'Erreur inattendue');
    } finally {
      this.loading.set(false);
    }
  }

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object';
  }
}