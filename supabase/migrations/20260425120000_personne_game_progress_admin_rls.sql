-- Lecture / gestion de la progression jeu côté admin (session Supabase authentifiée).

ALTER TABLE public.personne_game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.personne_game_progress;

CREATE POLICY "Admin full access"
  ON public.personne_game_progress
  FOR ALL
  TO public
  USING (auth.uid() IS NOT NULL);
