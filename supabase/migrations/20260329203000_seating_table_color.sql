-- Couleur d’affichage optionnelle pour les tables (hex #RRGGBB).

ALTER TABLE public.seating_table
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.seating_table.color IS 'Couleur du plateau (#RRGGBB), null = style par défaut.';
