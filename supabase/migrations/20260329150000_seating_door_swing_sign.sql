-- Sens d’ouverture des portes à battants : +1 ou -1 par rapport à la normale « vers la pièce ».

ALTER TABLE public.seating_door
  ADD COLUMN IF NOT EXISTS swing_sign smallint NOT NULL DEFAULT 1
    CHECK (swing_sign = ANY (ARRAY[-1, 1]));

COMMENT ON COLUMN public.seating_door.swing_sign IS
  'Pour single/double : multiplie la normale d''ouverture (côté battant). Ignoré pour opening (toujours 1).';
