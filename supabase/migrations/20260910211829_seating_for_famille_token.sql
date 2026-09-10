-- Table assignée (repas) pour les membres d’une famille, via token invité.
-- N’expose que personne_id + libellé de table, pas le plan complet.

CREATE OR REPLACE FUNCTION public.get_seating_for_famille_token(p_token text)
RETURNS TABLE (
  personne_id bigint,
  table_label text
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

  RETURN QUERY
  SELECT DISTINCT ON (sa.personne_id)
    sa.personne_id,
    COALESCE(
      NULLIF(BTRIM(st.label), ''),
      'Table ' || st.id::text
    ) AS table_label
  FROM public.seating_assignment sa
  JOIN public.seating_table st ON st.id = sa.table_id
  JOIN public.seating_layout_variant lv ON lv.id = sa.layout_variant_id
  JOIN public.personnes p ON p.id = sa.personne_id
  WHERE p.famille_id = fam.id
    AND COALESCE(p.invite_repas, false) = true
  ORDER BY sa.personne_id, lv.sort_order ASC, lv.id ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_seating_for_famille_token(text) IS
  'Libellé de table du repas pour les personnes invitées au banquet de la famille du token.';

REVOKE ALL ON FUNCTION public.get_seating_for_famille_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seating_for_famille_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_seating_for_famille_token(text) TO authenticated;
