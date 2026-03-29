import { Injectable, inject } from '@angular/core';
import { NgSupabaseService } from './ng-supabase.service';

export type SeatingTableShape = 'round' | 'rect' | 'oval' | 'capsule';

export interface SeatingVenue {
  id: number;
  created_at: string;
  name: string;
  room_width_cm: number;
  room_height_cm: number;
  background_data_url: string | null;
  background_x_cm: number;
  background_y_cm: number;
  background_width_cm: number | null;
  background_height_cm: number | null;
}

export interface SeatingLayoutVariant {
  id: number;
  created_at: string;
  venue_id: number;
  name: string;
  sort_order: number;
}

export interface SeatingWallSegment {
  id: number;
  venue_id: number;
  x1_cm: number;
  y1_cm: number;
  x2_cm: number;
  y2_cm: number;
  /** Épaisseur affichée (cm). Absent sur anciennes lignes : traiter comme 4 côté UI. */
  thickness_cm?: number;
}

export type SeatingPerimeterEdge = 'north' | 'east' | 'south' | 'west';

export interface SeatingWindow {
  id: number;
  created_at: string;
  venue_id: number;
  wall_segment_id: number | null;
  perimeter_edge: SeatingPerimeterEdge | null;
  /** Centre de l’ouverture le long du mur, depuis l’origine du segment (cm). */
  offset_along_cm: number;
  width_cm: number;
  thickness_cm: number;
}

export type SeatingDoorKind = 'single' | 'double' | 'opening';

export interface SeatingDoor {
  id: number;
  created_at: string;
  venue_id: number;
  wall_segment_id: number | null;
  perimeter_edge: SeatingPerimeterEdge | null;
  offset_along_cm: number;
  width_cm: number;
  thickness_cm: number;
  door_kind: SeatingDoorKind;
  /** +1 / -1 : côté d’ouverture (battants). Défaut 1 si colonne absente (anciennes lignes). */
  swing_sign?: 1 | -1;
}

export interface SeatingFreeformPolygon {
  id: number;
  created_at: string;
  venue_id: number;
  points_cm: [number, number][];
  stroke_width_cm: number;
}

export interface SeatingTable {
  id: number;
  layout_variant_id: number;
  shape: SeatingTableShape;
  label: string | null;
  /** Couleur du plateau (#RRGGBB), null = thème par défaut. */
  color?: string | null;
  center_x_cm: number;
  center_y_cm: number;
  rotation_deg: number;
  width_cm: number;
  depth_cm: number;
  max_chairs: number;
}

export interface SeatingAssignment {
  id: number;
  layout_variant_id: number;
  table_id: number;
  personne_id: number;
  seat_order: number;
}

export interface PersonneRepasRow {
  id: number;
  prenom: string;
  nom: string;
  famille_id: number;
  /** Supabase peut renvoyer un objet ou un tableau selon la relation. */
  familles: { personne_principale: number | null } | { personne_principale: number | null }[] | null;
}

@Injectable({ providedIn: 'root' })
export class SeatingPlanService {
  private supabase = inject(NgSupabaseService);

  async getVenue(): Promise<SeatingVenue | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_venue').select('*').order('id', { ascending: true }).limit(1).maybeSingle();
    if (error) {
      console.error('[SeatingPlanService] getVenue', error);
      return null;
    }
    return data as SeatingVenue | null;
  }

  async updateVenue(id: number, patch: Partial<Pick<SeatingVenue, 'name' | 'room_width_cm' | 'room_height_cm' | 'background_data_url' | 'background_x_cm' | 'background_y_cm' | 'background_width_cm' | 'background_height_cm'>>): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_venue').update(patch).eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] updateVenue', error);
      return false;
    }
    return true;
  }

  async getVariants(venueId: number): Promise<SeatingLayoutVariant[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_layout_variant')
      .select('*')
      .eq('venue_id', venueId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getVariants', error);
      return [];
    }
    return (data || []) as SeatingLayoutVariant[];
  }

  async createVariant(venueId: number, name: string): Promise<SeatingLayoutVariant | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_layout_variant')
      .insert({ venue_id: venueId, name, sort_order: Date.now() % 100000 })
      .select()
      .single();
    if (error) {
      console.error('[SeatingPlanService] createVariant', error);
      return null;
    }
    return data as SeatingLayoutVariant;
  }

  async deleteVariant(variantId: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_layout_variant').delete().eq('id', variantId);
    if (error) {
      console.error('[SeatingPlanService] deleteVariant', error);
      return false;
    }
    return true;
  }

  async renameVariant(variantId: number, name: string): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_layout_variant').update({ name }).eq('id', variantId);
    if (error) {
      console.error('[SeatingPlanService] renameVariant', error);
      return false;
    }
    return true;
  }

  /**
   * Duplique une variante : nouvelle ligne + tables + affectations (même disposition invités).
   * En cas d’échec partiel, la nouvelle variante est supprimée (CASCADE).
   */
  async copyVariant(sourceVariantId: number, name: string): Promise<SeatingLayoutVariant | null> {
    const client = this.supabase.getClient();
    const { data: srcVar, error: ve } = await client
      .from('seating_layout_variant')
      .select('*')
      .eq('id', sourceVariantId)
      .single();
    if (ve || !srcVar) {
      console.error('[SeatingPlanService] copyVariant load source', ve);
      return null;
    }
    const src = srcVar as SeatingLayoutVariant;
    const trimmed = name.trim();
    const newName = trimmed || `${src.name} (copie)`;
    const { data: newVarRow, error: ce } = await client
      .from('seating_layout_variant')
      .insert({
        venue_id: src.venue_id,
        name: newName,
        sort_order: Date.now() % 100000,
      })
      .select()
      .single();
    if (ce || !newVarRow) {
      console.error('[SeatingPlanService] copyVariant create variant', ce);
      return null;
    }
    const newVar = newVarRow as SeatingLayoutVariant;
    const newVariantId = newVar.id;

    const tables = await this.getTables(sourceVariantId);
    const idMap = new Map<number, number>();

    for (const t of tables) {
      const insertRow: Record<string, unknown> = {
        layout_variant_id: newVariantId,
        shape: t.shape,
        label: t.label ?? null,
        center_x_cm: t.center_x_cm,
        center_y_cm: t.center_y_cm,
        rotation_deg: t.rotation_deg,
        width_cm: t.width_cm,
        depth_cm: t.depth_cm,
        max_chairs: t.max_chairs,
      };
      if (t.color != null && t.color !== '') {
        insertRow['color'] = t.color;
      }
      const { data: ins, error: te } = await client.from('seating_table').insert(insertRow).select('id').single();
      if (te || !ins) {
        console.error('[SeatingPlanService] copyVariant table', te);
        await client.from('seating_layout_variant').delete().eq('id', newVariantId);
        return null;
      }
      idMap.set(t.id, (ins as { id: number }).id);
    }

    const assigns = await this.getAssignments(sourceVariantId);
    if (assigns.length > 0) {
      const assignRows: { layout_variant_id: number; table_id: number; personne_id: number; seat_order: number }[] = [];
      for (const a of assigns) {
        const tableId = idMap.get(a.table_id);
        if (tableId == null) {
          console.error('[SeatingPlanService] copyVariant table id map');
          await client.from('seating_layout_variant').delete().eq('id', newVariantId);
          return null;
        }
        assignRows.push({
          layout_variant_id: newVariantId,
          table_id: tableId,
          personne_id: a.personne_id,
          seat_order: a.seat_order,
        });
      }
      const { error: ae } = await client.from('seating_assignment').insert(assignRows);
      if (ae) {
        console.error('[SeatingPlanService] copyVariant assignments', ae);
        await client.from('seating_layout_variant').delete().eq('id', newVariantId);
        return null;
      }
    }

    return newVar;
  }

  async getWalls(venueId: number): Promise<SeatingWallSegment[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_wall_segment').select('*').eq('venue_id', venueId).order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getWalls', error);
      return [];
    }
    return (data || []) as SeatingWallSegment[];
  }

  async addWallSegment(
    venueId: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness_cm: number,
  ): Promise<SeatingWallSegment | null> {
    const client = this.supabase.getClient();
    const withThickness = {
      venue_id: venueId,
      x1_cm: x1,
      y1_cm: y1,
      x2_cm: x2,
      y2_cm: y2,
      thickness_cm,
    };
    let { data, error } = await client.from('seating_wall_segment').insert(withThickness).select().single();
    if (error && this.isMissingWallThicknessColumnError(error)) {
      const legacy = { venue_id: venueId, x1_cm: x1, y1_cm: y1, x2_cm: x2, y2_cm: y2 };
      const retry = await client.from('seating_wall_segment').insert(legacy).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error('[SeatingPlanService] addWallSegment', error);
      return null;
    }
    return data as SeatingWallSegment;
  }

  /** Schéma sans migration `thickness_cm` (PostgREST PGRST204). */
  private isMissingWallThicknessColumnError(err: { code?: string; message?: string }): boolean {
    return err.code === 'PGRST204' && (err.message ?? '').includes('thickness_cm');
  }

  async deleteWallSegment(id: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_wall_segment').delete().eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] deleteWallSegment', error);
      return false;
    }
    return true;
  }

  async getWindows(venueId: number): Promise<SeatingWindow[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_window')
      .select('*')
      .eq('venue_id', venueId)
      .order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getWindows', error);
      return [];
    }
    return (data || []) as SeatingWindow[];
  }

  async addWindow(row: {
    venue_id: number;
    wall_segment_id: number | null;
    perimeter_edge: SeatingPerimeterEdge | null;
    offset_along_cm: number;
    width_cm: number;
    thickness_cm: number;
  }): Promise<SeatingWindow | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_window').insert(row).select().single();
    if (error) {
      console.error('[SeatingPlanService] addWindow', error);
      return null;
    }
    return data as SeatingWindow;
  }

  async deleteWindow(id: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_window').delete().eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] deleteWindow', error);
      return false;
    }
    return true;
  }

  async getDoors(venueId: number): Promise<SeatingDoor[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_door')
      .select('*')
      .eq('venue_id', venueId)
      .order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getDoors', error);
      return [];
    }
    return (data || []) as SeatingDoor[];
  }

  async addDoor(row: {
    venue_id: number;
    wall_segment_id: number | null;
    perimeter_edge: SeatingPerimeterEdge | null;
    offset_along_cm: number;
    width_cm: number;
    thickness_cm: number;
    door_kind: SeatingDoorKind;
    swing_sign?: 1 | -1;
  }): Promise<SeatingDoor | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_door').insert(row).select().single();
    if (error) {
      console.error('[SeatingPlanService] addDoor', error);
      return null;
    }
    return data as SeatingDoor;
  }

  async deleteDoor(id: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_door').delete().eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] deleteDoor', error);
      return false;
    }
    return true;
  }

  private normalizeFreeformPolygonRow(row: Record<string, unknown>): SeatingFreeformPolygon {
    const raw = row['points_cm'];
    const pairs: [number, number][] = [];
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (Array.isArray(p) && p.length >= 2) {
          pairs.push([Number(p[0]), Number(p[1])]);
        }
      }
    }
    return {
      id: Number(row['id']),
      created_at: String(row['created_at'] ?? ''),
      venue_id: Number(row['venue_id']),
      points_cm: pairs,
      stroke_width_cm: Number(row['stroke_width_cm'] ?? 3),
    };
  }

  async getFreeformPolygons(venueId: number): Promise<SeatingFreeformPolygon[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_freeform_polygon')
      .select('*')
      .eq('venue_id', venueId)
      .order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getFreeformPolygons', error);
      return [];
    }
    return (data || []).map((r) => this.normalizeFreeformPolygonRow(r as Record<string, unknown>));
  }

  async addFreeformPolygon(
    venueId: number,
    pointsCm: [number, number][],
    strokeWidthCm: number,
  ): Promise<SeatingFreeformPolygon | null> {
    if (pointsCm.length < 3) return null;
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_freeform_polygon')
      .insert({
        venue_id: venueId,
        points_cm: pointsCm,
        stroke_width_cm: Math.max(0.5, strokeWidthCm),
      })
      .select()
      .single();
    if (error) {
      console.error('[SeatingPlanService] addFreeformPolygon', error);
      return null;
    }
    return this.normalizeFreeformPolygonRow(data as Record<string, unknown>);
  }

  async deleteFreeformPolygon(id: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_freeform_polygon').delete().eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] deleteFreeformPolygon', error);
      return false;
    }
    return true;
  }

  async getTables(variantId: number): Promise<SeatingTable[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_table').select('*').eq('layout_variant_id', variantId).order('id', { ascending: true });
    if (error) {
      console.error('[SeatingPlanService] getTables', error);
      return [];
    }
    return (data || []) as SeatingTable[];
  }

  async createTable(
    variantId: number,
    shape: SeatingTableShape,
    centerX: number,
    centerY: number,
    widthCm: number,
    depthCm: number,
    maxChairs: number,
    label?: string | null,
  ): Promise<SeatingTable | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('seating_table')
      .insert({
        layout_variant_id: variantId,
        shape,
        label: label ?? null,
        center_x_cm: centerX,
        center_y_cm: centerY,
        rotation_deg: 0,
        width_cm: widthCm,
        depth_cm: depthCm,
        max_chairs: maxChairs,
      })
      .select()
      .single();
    if (error) {
      console.error('[SeatingPlanService] createTable', error);
      return null;
    }
    return data as SeatingTable;
  }

  async updateTable(
    id: number,
    patch: Partial<
      Pick<
        SeatingTable,
        | 'label'
        | 'color'
        | 'center_x_cm'
        | 'center_y_cm'
        | 'rotation_deg'
        | 'width_cm'
        | 'depth_cm'
        | 'max_chairs'
        | 'shape'
      >
    >,
  ): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_table').update(patch).eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] updateTable', error);
      return false;
    }
    return true;
  }

  async deleteTable(id: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_table').delete().eq('id', id);
    if (error) {
      console.error('[SeatingPlanService] deleteTable', error);
      return false;
    }
    return true;
  }

  async getAssignments(variantId: number): Promise<SeatingAssignment[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client.from('seating_assignment').select('*').eq('layout_variant_id', variantId);
    if (error) {
      console.error('[SeatingPlanService] getAssignments', error);
      return [];
    }
    return (data || []) as SeatingAssignment[];
  }

  async countAssignmentsForTable(tableId: number): Promise<number> {
    const client = this.supabase.getClient();
    const { count, error } = await client.from('seating_assignment').select('*', { count: 'exact', head: true }).eq('table_id', tableId);
    if (error) return 0;
    return count ?? 0;
  }

  async assignPerson(variantId: number, tableId: number, personneId: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { data: table, error: te } = await client.from('seating_table').select('max_chairs, layout_variant_id').eq('id', tableId).single();
    if (te || !table || table.layout_variant_id !== variantId) return false;
    const maxChairs = table.max_chairs as number;
    const { count, error: ce } = await client.from('seating_assignment').select('*', { count: 'exact', head: true }).eq('table_id', tableId);
    if (ce || (count ?? 0) >= maxChairs) return false;

    const { count: existing, error: ee } = await client
      .from('seating_assignment')
      .select('*', { count: 'exact', head: true })
      .eq('layout_variant_id', variantId)
      .eq('personne_id', personneId);
    if (ee || (existing ?? 0) > 0) return false;

    const { data: lastRows, error: se } = await client
      .from('seating_assignment')
      .select('seat_order')
      .eq('table_id', tableId)
      .order('seat_order', { ascending: false })
      .limit(1);
    if (se) return false;
    const seatOrder = lastRows?.length ? (lastRows[0] as { seat_order: number }).seat_order + 1 : 0;

    const { error } = await client.from('seating_assignment').insert({
      layout_variant_id: variantId,
      table_id: tableId,
      personne_id: personneId,
      seat_order: seatOrder,
    });
    if (error) {
      console.error('[SeatingPlanService] assignPerson', error);
      return false;
    }
    return true;
  }

  async unassignPerson(variantId: number, personneId: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client.from('seating_assignment').delete().eq('layout_variant_id', variantId).eq('personne_id', personneId);
    if (error) {
      console.error('[SeatingPlanService] unassignPerson', error);
      return false;
    }
    return true;
  }

  /**
   * Déplace un invité déjà placé vers une autre table (même variante).
   * No-op si `newTableId` est la table actuelle. Retourne false si table pleine ou incohérente.
   */
  async movePersonToTable(variantId: number, personneId: number, newTableId: number): Promise<boolean> {
    const client = this.supabase.getClient();
    const { data: cur, error: ce } = await client
      .from('seating_assignment')
      .select('id, table_id')
      .eq('layout_variant_id', variantId)
      .eq('personne_id', personneId)
      .maybeSingle();
    if (ce) {
      console.error('[SeatingPlanService] movePersonToTable load', ce);
      return false;
    }
    if (!cur) return false;
    const curRow = cur as { id: number; table_id: number };
    if (curRow.table_id === newTableId) return true;

    const { data: table, error: te } = await client
      .from('seating_table')
      .select('max_chairs, layout_variant_id')
      .eq('id', newTableId)
      .single();
    if (te || !table || table.layout_variant_id !== variantId) return false;
    const maxChairs = table.max_chairs as number;
    const { count, error: cntE } = await client
      .from('seating_assignment')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', newTableId);
    if (cntE || (count ?? 0) >= maxChairs) return false;

    const { error: delE } = await client.from('seating_assignment').delete().eq('id', curRow.id);
    if (delE) {
      console.error('[SeatingPlanService] movePersonToTable delete', delE);
      return false;
    }

    const { data: lastRows, error: se } = await client
      .from('seating_assignment')
      .select('seat_order')
      .eq('table_id', newTableId)
      .order('seat_order', { ascending: false })
      .limit(1);
    if (se) {
      console.error('[SeatingPlanService] movePersonToTable seat_order', se);
      return false;
    }
    const seatOrder = lastRows?.length ? (lastRows[0] as { seat_order: number }).seat_order + 1 : 0;

    const { error: insE } = await client.from('seating_assignment').insert({
      layout_variant_id: variantId,
      table_id: newTableId,
      personne_id: personneId,
      seat_order: seatOrder,
    });
    if (insE) {
      console.error('[SeatingPlanService] movePersonToTable insert', insE);
      return false;
    }
    return true;
  }

  async getPersonnesRepas(): Promise<PersonneRepasRow[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('personnes')
      .select(
        'id, prenom, nom, famille_id, familles!personnes_famille_id_fkey(personne_principale)',
      )
      .eq('invite_repas', true)
      .order('nom')
      .order('prenom');
    if (error) {
      console.error('[SeatingPlanService] getPersonnesRepas', error);
      return [];
    }
    return (data || []) as unknown as PersonneRepasRow[];
  }
}
