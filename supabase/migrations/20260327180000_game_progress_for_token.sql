-- Progression du jeu par personne (flags JSON) accessible via token invité.

CREATE TABLE IF NOT EXISTS public.personne_game_progress (
  personne_id bigint PRIMARY KEY REFERENCES public.personnes (id) ON DELETE CASCADE,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personne_game_progress IS
  'Progression du mini-jeu pour une personne (flags JSON). Écriture/lecture uniquement via RPC SECURITY DEFINER et token.';

ALTER TABLE public.personne_game_progress ENABLE ROW LEVEL SECURITY;
-- Pas de policy directe: accès via fonctions SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_game_progress_for_token(p_token text, p_personne_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fam public.familles%ROWTYPE;
  v_flags jsonb;
BEGIN
  SELECT * INTO fam FROM public.get_famille_by_token(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE p.id = p_personne_id AND p.famille_id = fam.id
  ) THEN
    RAISE EXCEPTION 'personne_not_in_famille';
  END IF;

  SELECT pg.flags INTO v_flags
  FROM public.personne_game_progress pg
  WHERE pg.personne_id = p_personne_id;

  RETURN COALESCE(v_flags, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_game_progress_for_token(p_token text, p_personne_id bigint, p_flags jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fam public.familles%ROWTYPE;
BEGIN
  SELECT * INTO fam FROM public.get_famille_by_token(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE p.id = p_personne_id AND p.famille_id = fam.id
  ) THEN
    RAISE EXCEPTION 'personne_not_in_famille';
  END IF;

  INSERT INTO public.personne_game_progress (personne_id, flags, updated_at)
  VALUES (p_personne_id, COALESCE(p_flags, '{}'::jsonb), now())
  ON CONFLICT (personne_id)
  DO UPDATE SET
    flags = COALESCE(p_flags, '{}'::jsonb),
    updated_at = now();

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_game_progress_for_token(p_token text, p_personne_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fam public.familles%ROWTYPE;
BEGIN
  SELECT * INTO fam FROM public.get_famille_by_token(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.personnes p
    WHERE p.id = p_personne_id AND p.famille_id = fam.id
  ) THEN
    RAISE EXCEPTION 'personne_not_in_famille';
  END IF;

  DELETE FROM public.personne_game_progress pg
  WHERE pg.personne_id = p_personne_id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_game_progress_for_token(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_game_progress_for_token(text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_game_progress_for_token(text, bigint, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_game_progress_for_token(text, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_game_progress_for_token(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_game_progress_for_token(text, bigint) TO authenticated;

