import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AvatarAssetsService, AvatarAsset, AvatarCategories, AvatarCategory } from '../../services/avatar-assets.service';
import { AvatarChoiceService } from '../../services/avatar-choice.service';
import { NgSupabaseService } from '../../services/supabase.service';
import { SessionService } from '../../services/session.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: true,
  selector: 'app-avatar-editor',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatSelectModule, MatIconModule, MatProgressBarModule],
  templateUrl: './avatar-editor.component.html',
  styleUrls: ['./avatar-editor.component.css']
})
export class AvatarEditorComponent {
  categories = AvatarCategories;
  assets: AvatarAsset[] = [];
  byCategory: Record<AvatarCategory, AvatarAsset[]> = {} as any;
  selected: Partial<Record<AvatarCategory, string>> = {};
  personneId: number | null = null;
  personnes: Array<{ id: number; nom?: string; prenom?: string }> = [];
  avatarId: number | null = null;
  error = '';
  saving = false;
  previewLayers: Array<{ url: string; label: string; depth: number }> = [];
  exporting = false;

  constructor(
    private assetsSvc: AvatarAssetsService,
    private choiceSvc: AvatarChoiceService,
    private api: NgSupabaseService,
    private toast: ToastService,
    private session: SessionService
  ) {
    this.init();
  }

  async init() {
    try {
  // Préparer la session partagée (token + personnes)
  await this.session.init();
  if (this.session.error) { this.error = this.session.error; return; }
  this.personnes = this.session.personnes;
  const id = this.session.getSelectedPersonneId();
  if (!id) { this.error = 'Aucune personne liée'; return; }
  this.personneId = id;

      // Charger assets
      this.assets = await this.assetsSvc.listAssets();
      this.byCategory = this.assets.reduce((acc, a) => {
        (acc[a.category] = acc[a.category] || []).push(a);
        return acc;
      }, {} as Record<AvatarCategory, AvatarAsset[]>);

      // Avatar et choix
      const avatar = await this.choiceSvc.ensureAvatarForPersonne(this.personneId);
      this.avatarId = avatar.id;
      const choices = await this.choiceSvc.getChoices(avatar.id);
      this.selected = choices.reduce((acc, ch) => { acc[ch.category] = ch.asset_id; return acc; }, {} as any);
      this.refreshPreview();
    } catch (e: any) {
      this.error = e?.message || 'Erreur de chargement';
    }
  }

  labelFor(cat: AvatarCategory): string | null {
    const id = this.selected[cat];
    if (!id) return null;
    const list = this.byCategory[cat] || [];
    return (list.find(a => a.id === id)?.label) || null;
  }

  isSelected(cat: AvatarCategory, a: AvatarAsset) {
    return this.selected[cat] === a.id;
  }

  select(cat: AvatarCategory, a: AvatarAsset) {
    this.selected[cat] = a.id;
    this.refreshPreview();
  }

  clear(cat: AvatarCategory) {
    delete this.selected[cat];
    this.refreshPreview();
  }

  async reload() { await this.init(); }

  async save() {
    if (!this.personneId) return;
    this.saving = true;
    try {
      // Préférer la RPC
      try {
        await this.choiceSvc.upsertChoicesRPC(this.personneId, this.selected);
      } catch {
        if (!this.avatarId) throw new Error('Avatar manquant');
        await this.choiceSvc.upsertChoices(this.avatarId, this.selected);
      }
      this.toast.success('Avatar enregistré');
    } catch (e: any) {
      this.toast.error('Erreur enregistrement');
    } finally {
      this.saving = false;
    }
  }

  urlFor(a: AvatarAsset) { return this.assetsSvc.getPublicUrl(a.storage_path); }

  refreshPreview() {
    const layers: Array<{ url: string; label: string; depth: number }> = [];
    for (const cat of this.categories) {
      const id = this.selected[cat.id];
      if (!id) continue;
      const asset = (this.byCategory[cat.id] || []).find(x => x.id === id);
      if (!asset) continue;
      layers.push({ url: this.urlFor(asset), label: asset.label, depth: asset.depth ?? 50 });
    }
    this.previewLayers = layers.sort((a, b) => (a.depth - b.depth));
  }

  async onPersonChange() {
    if (!this.personneId) return;
    try {
      this.session.setSelectedPersonneId(this.personneId);
      const avatar = await this.choiceSvc.ensureAvatarForPersonne(this.personneId);
      this.avatarId = avatar.id;
      const choices = await this.choiceSvc.getChoices(avatar.id);
      this.selected = choices.reduce((acc, ch) => { acc[ch.category] = ch.asset_id; return acc; }, {} as any);
      this.refreshPreview();
    } catch (e: any) {
      this.toast.error('Chargement des choix impossible');
    }
  }

  async exportPng() {
    if (!this.previewLayers.length) { this.toast.info('Aucun calque sélectionné'); return; }
    this.exporting = true;
    try {
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas non supporté');
      // Charger les images puis dessiner dans l’ordre
      for (const layer of this.previewLayers) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('Chargement image raté'));
          im.src = layer.url;
        });
        ctx.drawImage(img, 0, 0, size, size);
      }
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const base = this.personneId ? `avatar_${this.personneId}` : 'avatar';
      a.download = `${base}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.toast.success('Export PNG effectué');
    } catch (e: any) {
      this.toast.error("Export impossible (CORS?). Essayez depuis le domaine de prod.");
    } finally {
      this.exporting = false;
    }
  }
}
