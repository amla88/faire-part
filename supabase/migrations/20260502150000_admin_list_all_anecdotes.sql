-- Liste toutes les anecdotes (personne_anecdotes) pour l’admin, plus récentes en premier.

CREATE OR REPLACE FUNCTION public.admin_list_all_anecdotes()
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
    a.id,
    p.id AS personne_id,
    p.prenom,
    p.nom,
    p.famille_id,
    a.contenu,
    a.created_at
  FROM public.personne_anecdotes a
  INNER JOIN public.personnes p ON p.id = a.personne_id
  ORDER BY a.created_at DESC;
END;
$function$;

COMMENT ON FUNCTION public.admin_list_all_anecdotes() IS
  'Retourne toutes les anecdotes déposées par les invités (session authentifiée), plus récentes en premier.';

REVOKE ALL ON FUNCTION public.admin_list_all_anecdotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_all_anecdotes() TO authenticated;
