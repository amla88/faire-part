-- Forme de table « capsule » (rectangle + demi-cercles aux extrémités).

ALTER TABLE public.seating_table DROP CONSTRAINT IF EXISTS seating_table_shape_check;

ALTER TABLE public.seating_table
  ADD CONSTRAINT seating_table_shape_check CHECK (
    shape = ANY (ARRAY['round'::text, 'rect'::text, 'oval'::text, 'capsule'::text])
  );
