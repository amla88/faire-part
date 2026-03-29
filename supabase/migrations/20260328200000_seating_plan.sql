-- Plan de table : salle, variantes de disposition, murs, tables, affectations invités (repas).

CREATE TABLE public.seating_venue (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL DEFAULT 'Salle',
  room_width_cm integer NOT NULL CHECK (room_width_cm > 0),
  room_height_cm integer NOT NULL CHECK (room_height_cm > 0),
  background_data_url text,
  background_x_cm integer NOT NULL DEFAULT 0,
  background_y_cm integer NOT NULL DEFAULT 0,
  background_width_cm integer,
  background_height_cm integer,
  CONSTRAINT seating_venue_bg_dims CHECK (
    background_data_url IS NULL
    OR (
      background_width_cm IS NOT NULL
      AND background_height_cm IS NOT NULL
      AND background_width_cm > 0
      AND background_height_cm > 0
    )
  )
);

CREATE TABLE public.seating_layout_variant (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  venue_id bigint NOT NULL REFERENCES public.seating_venue (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX seating_layout_variant_venue_id_idx ON public.seating_layout_variant (venue_id);

CREATE TABLE public.seating_wall_segment (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  venue_id bigint NOT NULL REFERENCES public.seating_venue (id) ON DELETE CASCADE,
  x1_cm integer NOT NULL,
  y1_cm integer NOT NULL,
  x2_cm integer NOT NULL,
  y2_cm integer NOT NULL
);

CREATE INDEX seating_wall_segment_venue_id_idx ON public.seating_wall_segment (venue_id);

-- Formes : round (width_cm = diamètre), rect, oval (ellipse dans le rectangle width x depth).
CREATE TABLE public.seating_table (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  layout_variant_id bigint NOT NULL REFERENCES public.seating_layout_variant (id) ON DELETE CASCADE,
  shape text NOT NULL CHECK (shape = ANY (ARRAY['round'::text, 'rect'::text, 'oval'::text])),
  label text,
  center_x_cm integer NOT NULL,
  center_y_cm integer NOT NULL,
  rotation_deg integer NOT NULL DEFAULT 0,
  width_cm integer NOT NULL CHECK (width_cm > 0),
  depth_cm integer NOT NULL CHECK (depth_cm > 0),
  max_chairs integer NOT NULL CHECK (max_chairs > 0)
);

CREATE INDEX seating_table_layout_variant_id_idx ON public.seating_table (layout_variant_id);

CREATE TABLE public.seating_assignment (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  layout_variant_id bigint NOT NULL REFERENCES public.seating_layout_variant (id) ON DELETE CASCADE,
  table_id bigint NOT NULL REFERENCES public.seating_table (id) ON DELETE CASCADE,
  personne_id bigint NOT NULL REFERENCES public.personnes (id) ON DELETE CASCADE,
  seat_order integer NOT NULL DEFAULT 0,
  UNIQUE (layout_variant_id, personne_id),
  UNIQUE (table_id, personne_id)
);

CREATE INDEX seating_assignment_layout_variant_id_idx ON public.seating_assignment (layout_variant_id);
CREATE INDEX seating_assignment_table_id_idx ON public.seating_assignment (table_id);

ALTER TABLE public.seating_venue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_layout_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_wall_segment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.seating_venue FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access" ON public.seating_layout_variant FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access" ON public.seating_wall_segment FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access" ON public.seating_table FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access" ON public.seating_assignment FOR ALL USING (auth.uid() IS NOT NULL);

-- Données initiales : une salle + une variante vide
WITH v AS (
  INSERT INTO public.seating_venue (name, room_width_cm, room_height_cm)
  VALUES ('Salle principale', 2000, 1500)
  RETURNING id
)
INSERT INTO public.seating_layout_variant (venue_id, name, sort_order)
SELECT id, 'Variante A', 0 FROM v;
