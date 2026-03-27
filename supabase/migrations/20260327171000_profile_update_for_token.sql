-- Mise à jour profil invité (hors nom/prénom) via token.

CREATE OR REPLACE FUNCTION public.update_profile_for_token(
  p_token text,
  p_personne_id bigint,
  p_email text,
  p_rue text,
  p_numero text,
  p_boite text,
  p_cp text,
  p_ville text,
  p_pays text
)
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

  UPDATE public.personnes
  SET email = NULLIF(trim(COALESCE(p_email, '')), '')
  WHERE id = p_personne_id
    AND famille_id = fam.id;

  UPDATE public.familles
  SET
    rue = NULLIF(trim(COALESCE(p_rue, '')), ''),
    numero = NULLIF(trim(COALESCE(p_numero, '')), ''),
    boite = NULLIF(trim(COALESCE(p_boite, '')), ''),
    cp = NULLIF(trim(COALESCE(p_cp, '')), ''),
    ville = NULLIF(trim(COALESCE(p_ville, '')), ''),
    pays = NULLIF(trim(COALESCE(p_pays, '')), '')
  WHERE id = fam.id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_profile_for_token(
  text, bigint, text, text, text, text, text, text, text
) TO anon;
GRANT EXECUTE ON FUNCTION public.update_profile_for_token(
  text, bigint, text, text, text, text, text, text, text
) TO authenticated;

