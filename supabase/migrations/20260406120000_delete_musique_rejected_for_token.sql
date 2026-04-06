-- Allow guests to delete their own musique when status is pending OR rejected (so they can free a slot after admin refusal).

CREATE OR REPLACE FUNCTION public.delete_musique_for_token(p_token text, p_musique_id bigint)
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

  DELETE FROM public.musiques m
  WHERE m.id = p_musique_id
    AND m.status IN ('pending', 'rejected')
    AND EXISTS (
      SELECT 1 FROM public.personnes p
      WHERE p.id = m.personne_id AND p.famille_id = fam.id
    );

  IF FOUND THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$function$;
