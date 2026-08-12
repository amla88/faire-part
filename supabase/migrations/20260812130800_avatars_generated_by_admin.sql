-- Marque les avatars générés par l'admin pour les distinguer de ceux créés par les invités.

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS generated_by_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.avatars.generated_by_admin IS
  'true si l''avatar a été généré automatiquement par un administrateur';

-- Génération admin : autorisée uniquement lorsqu''aucun avatar n''est encore configuré.
CREATE OR REPLACE FUNCTION public.generate_avatar_for_admin(
  p_personne_id bigint,
  p_seed text,
  p_options jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.avatars%ROWTYPE;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'personne_not_found';
  END IF;

  SELECT * INTO existing FROM public.avatars WHERE personne_id = p_personne_id;

  IF FOUND THEN
    IF COALESCE(NULLIF(trim(existing.seed), ''), '') <> ''
       OR (existing.options IS NOT NULL AND existing.options <> '{}'::jsonb)
    THEN
      RAISE EXCEPTION 'avatar_already_exists';
    END IF;
  END IF;

  INSERT INTO public.avatars (personne_id, seed, options, generated_by_admin)
  VALUES (p_personne_id, p_seed, COALESCE(p_options, '{}'::jsonb), true)
  ON CONFLICT (personne_id) DO UPDATE
    SET seed = EXCLUDED.seed,
        options = EXCLUDED.options,
        generated_by_admin = true,
        updated_at = now()
  RETURNING to_jsonb(public.avatars.*) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_avatar_for_admin(bigint, text, jsonb) TO authenticated;

-- Les invités reprennent la main sur leur effigie (remplace un avatar admin).
CREATE OR REPLACE FUNCTION public.upsert_avatar_for_token(
  p_token text,
  p_personne_id bigint,
  p_seed text,
  p_options jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fam RECORD;
  result jsonb;
BEGIN
  SELECT * INTO fam FROM get_famille_by_token(p_token);
  IF fam IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM personnes WHERE id = p_personne_id AND famille_id = fam.id) THEN
    RAISE EXCEPTION 'personne_not_in_famille';
  END IF;

  INSERT INTO avatars(personne_id, seed, options, generated_by_admin)
  VALUES (p_personne_id, p_seed, COALESCE(p_options, '{}'::jsonb), false)
  ON CONFLICT (personne_id) DO UPDATE
    SET seed = EXCLUDED.seed,
        options = EXCLUDED.options,
        generated_by_admin = false,
        updated_at = now()
  RETURNING to_jsonb(avatars.*) INTO result;

  RETURN result;
END;
$$;

-- Accès admin direct (lecture / modération).
DROP POLICY IF EXISTS "Admin full access" ON public.avatars;
CREATE POLICY "Admin full access"
  ON public.avatars
  FOR ALL
  USING (auth.uid() IS NOT NULL);
