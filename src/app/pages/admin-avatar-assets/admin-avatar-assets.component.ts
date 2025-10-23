import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AvatarAssetsService, AvatarCategories, AvatarCategory, AvatarAsset } from '../../services/avatar-assets.service';

@Component({
  standalone: true,
  selector: 'app-admin-avatar-assets',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './admin-avatar-assets.component.html',
  styleUrls: ['./admin-avatar-assets.component.css']
})
export class AdminAvatarAssetsComponent {
  categories = AvatarCategories;
  category: AvatarCategory = 'skin';
  assets: AvatarAsset[] = [];
  file: File | null = null;
  label = '';
  orderIndex = 0;
  depth = 50;
  busy = signal(false);

  constructor(public service: AvatarAssetsService) {
    this.refresh();
  }

  async refresh() {
    this.busy.set(true);
    try {
      this.assets = await this.service.listAssets(this.category);
    } finally {
      this.busy.set(false);
    }
  }

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
  }

  async create() {
    if (!this.file || !this.label) return;
    this.busy.set(true);
    try {
      await this.service.createAsset({ file: this.file, category: this.category, label: this.label, order_index: this.orderIndex, depth: this.depth });
      this.file = null; this.label = ''; this.orderIndex = 0; this.depth = 50;
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  async update(a: AvatarAsset, patch: any) {
    this.busy.set(true);
    try {
      await this.service.updateAsset(a.id, {
        label: patch.label ?? a.label,
        order_index: patch.order_index ?? a.order_index,
        depth: patch.depth ?? a.depth,
        category: (patch.category as AvatarCategory) ?? a.category,
        enabled: patch.enabled ?? a.enabled,
      });
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  async replace(a: AvatarAsset, e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (!f) return;
    this.busy.set(true);
    try {
      await this.service.replaceAssetFile(a.id, a.storage_path, f);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  async remove(a: AvatarAsset) {
    if (!confirm(`Supprimer ${a.label} ?`)) return;
    this.busy.set(true);
    try {
      await this.service.deleteAsset(a.id, a.storage_path);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  async move(a: AvatarAsset, newCat: AvatarCategory) {
    if (newCat === a.category) return;
    this.busy.set(true);
    try {
      await this.service.moveAssetToCategory(a.id, a.storage_path, newCat);
      await this.refresh();
    } finally {
      this.busy.set(false);
    }
  }
}
