-- Profil invité (personne + adresse famille) accessible via token invité.

CREATE OR REPLACE FUNCTION public.get_profile_for_token(p_token text, p_personne_id bigint)
RETURNS TABLE (
  personne_id bigint,
  prenom text,
  nom text,
  email text,
  famille_id bigint,
  rue text,
  numero text,
  boite text,
  cp text,
  ville text,
  pays text
)
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

  RETURN QUERY
  SELECT
    p.id AS personne_id,
    p.prenom,
    p.nom,
    p.email,
    f.id AS famille_id,
    f.rue,
    f.numero,
    f.boite,
    f.cp,
    f.ville,
    f.pays
  FROM public.personnes p
  JOIN public.familles f ON f.id = p.famille_id
  WHERE p.id = p_personne_id
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_profile_for_token(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_for_token(text, bigint) TO authenticated;

