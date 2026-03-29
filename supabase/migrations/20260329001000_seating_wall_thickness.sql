-- Épaisseur par segment de mur (cm, repère plan).
ALTER TABLE public.seating_wall_segment
  ADD COLUMN thickness_cm integer NOT NULL DEFAULT 4 CHECK (thickness_cm > 0);
