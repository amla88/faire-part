-- Portes et ouvertures sur murs (même logique de pose que les fenêtres).

CREATE TABLE public.seating_door (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  venue_id bigint NOT NULL REFERENCES public.seating_venue (id) ON DELETE CASCADE,
  wall_segment_id bigint REFERENCES public.seating_wall_segment (id) ON DELETE CASCADE,
  perimeter_edge text CHECK (perimeter_edge IS NULL OR perimeter_edge = ANY (ARRAY['north'::text, 'east'::text, 'south'::text, 'west'::text])),
  offset_along_cm double precision NOT NULL CHECK (offset_along_cm >= 0::double precision),
  width_cm integer NOT NULL CHECK (width_cm > 0),
  thickness_cm integer NOT NULL CHECK (thickness_cm > 0),
  door_kind text NOT NULL CHECK (door_kind = ANY (ARRAY['single'::text, 'double'::text, 'opening'::text])),
  CONSTRAINT seating_door_wall_xor CHECK (
    (wall_segment_id IS NOT NULL AND perimeter_edge IS NULL)
    OR (wall_segment_id IS NULL AND perimeter_edge IS NOT NULL)
  )
);

CREATE INDEX seating_door_venue_id_idx ON public.seating_door (venue_id);

ALTER TABLE public.seating_door ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.seating_door FOR ALL USING (auth.uid() IS NOT NULL);
