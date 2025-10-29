import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgSupabaseService } from '../../../services/ng-supabase.service';

@Component({
  selector: 'app-admin-famille',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-famille.component.html',
  styleUrls: ['./admin-famille.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFamilleComponent {
  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });
  loading = false;
  message = '';

  constructor(private fb: FormBuilder, private ngSupabase: NgSupabaseService) {}

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    try {
      // Use a server-side RPC for safer inserts (SECURITY DEFINER)
      // The `familles` table in this project doesn't have a single 'name' column,
      // so we create a new famille row with DEFAULT VALUES server-side.
      const res = await this.ngSupabase.rpc('insert_famille');
      const { data, error } = res || {};
      if (error) throw error;
      this.message = 'Famille ajoutée.';
      this.form.reset();
    } catch (err: any) {
      console.error(err);
      // RLS errors may be opaque; display a helpful message
      this.message = 'Erreur lors de l\'insertion : ' + (err?.message ?? err);
    } finally {
      this.loading = false;
    }
  }
}
