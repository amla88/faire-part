-- Garde admin : Supabase Auth ne met en général pas « role » = 'admin' à la racine du JWT.
-- Toute session authentifiée suffit (même modèle que l’accès admin au reste du projet).

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

COMMENT ON FUNCTION public.admin_list_all_idees() IS
  'Liste toutes les idées (admin), session Supabase authentifiée requise.';

COMMENT ON FUNCTION public.admin_list_all_anecdotes() IS
  'Liste toutes les anecdotes (admin), session Supabase authentifiée requise.';

REVOKE ALL ON FUNCTION public.admin_list_all_idees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_all_idees() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_all_anecdotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_all_anecdotes() TO authenticated;
