-- Liste toutes les idées (boîte à idées) pour le tableau de bord admin, tri du plus récent au plus ancien.

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

COMMENT ON FUNCTION public.admin_list_all_idees() IS
  'Retourne toutes les entrées de la boîte à idées (session authentifiée), plus récentes en premier.';

REVOKE ALL ON FUNCTION public.admin_list_all_idees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_all_idees() TO authenticated;
