-- Historique : correction après retrait de is_admin() — remplacée par garde auth.uid() dans 20260502160000.

CREATE OR REPLACE FUNCTION public.admin_list_all_idees()
RETURNS TABLE(
  id bigint,
  personne_id bigint,
  prenom text,
  nom text,
  famille_id bigint,
  contenu text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    p.id AS personne_id,
    p.prenom,
    p.nom,
    p.famille_id,
    i.contenu,
    i.created_at
  FROM public.personne_idees i
  INNER JOIN public.personnes p ON p.id = i.personne_id
  ORDER BY i.created_at DESC;
END;
$function$;
