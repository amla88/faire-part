-- Polygones libres (décoration / zones) sur le plan de la salle.

CREATE TABLE public.seating_freeform_polygon (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  venue_id bigint NOT NULL REFERENCES public.seating_venue (id) ON DELETE CASCADE,
  /** Tableau JSON [[x_cm,y_cm], ...] au moins 3 sommets, repère pièce. */
  points_cm jsonb NOT NULL,
  stroke_width_cm double precision NOT NULL DEFAULT 3 CHECK (stroke_width_cm > 0::double precision),
  CONSTRAINT seating_freeform_points_is_array CHECK (jsonb_typeof(points_cm) = 'array'),
  CONSTRAINT seating_freeform_points_min_len CHECK (jsonb_array_length(points_cm) >= 3)
);

CREATE INDEX seating_freeform_polygon_venue_id_idx ON public.seating_freeform_polygon (venue_id);

ALTER TABLE public.seating_freeform_polygon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.seating_freeform_polygon FOR ALL USING (auth.uid() IS NOT NULL);
