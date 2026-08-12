-- Permet à l'admin de regénérer / modifier un avatar déjà marqué generated_by_admin.

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
  has_user_avatar boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.personnes WHERE id = p_personne_id) THEN
    RAISE EXCEPTION 'personne_not_found';
  END IF;

  SELECT * INTO existing FROM public.avatars WHERE personne_id = p_personne_id;

  IF FOUND THEN
    has_user_avatar :=
      NOT COALESCE(existing.generated_by_admin, false)
      AND (
        COALESCE(NULLIF(trim(existing.seed), ''), '') <> ''
        OR (existing.options IS NOT NULL AND existing.options <> '{}'::jsonb)
      );

    IF has_user_avatar THEN
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
