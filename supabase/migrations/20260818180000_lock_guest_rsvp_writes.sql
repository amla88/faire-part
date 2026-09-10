-- Bloque les mises à jour RSVP des invités (SECURITY DEFINER + anon).
-- Les admins authentifiés (auth.uid() IS NOT NULL) conservent l'accès.

CREATE OR REPLACE FUNCTION public.record_rsvp(p_famille_id integer, p_payload jsonb)
 RETURNS TABLE(updated integer, errors jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  item jsonb;
  personne_id int;
  updated_count int := 0;
  errs jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'rsvp_closed';
  END IF;

  IF p_payload IS NULL THEN
    RETURN QUERY SELECT updated_count, errs;
    RETURN;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_payload)
  LOOP
    BEGIN
      IF NOT (item ? 'personne_id') THEN
        errs := errs || jsonb_build_array(jsonb_build_object('item', item, 'error', 'missing_personne_id'));
        CONTINUE;
      END IF;

      personne_id := (item->>'personne_id')::int;

      UPDATE personnes
      SET
        decline_invitation = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN true
          WHEN (item ? 'present_reception' AND (item->>'present_reception')::boolean IS TRUE)
            OR (item ? 'present_repas' AND (item->>'present_repas')::boolean IS TRUE)
            OR (item ? 'present_soiree' AND (item->>'present_soiree')::boolean IS TRUE)
            OR (item ? 'present_anniversaire' AND (item->>'present_anniversaire')::boolean IS TRUE)
            THEN false
          WHEN (item ? 'decline_invitation') THEN false
          ELSE decline_invitation
        END,
        present_reception = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN false
          WHEN (item ? 'present_reception') THEN (item->>'present_reception')::boolean
          ELSE present_reception
        END,
        present_repas = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN false
          WHEN (item ? 'present_repas') THEN (item->>'present_repas')::boolean
          ELSE present_repas
        END,
        present_soiree = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN false
          WHEN (item ? 'present_soiree') THEN (item->>'present_soiree')::boolean
          ELSE present_soiree
        END,
        present_anniversaire = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN false
          WHEN (item ? 'present_anniversaire') THEN (item->>'present_anniversaire')::boolean
          ELSE present_anniversaire
        END,
        allergenes_alimentaires = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN NULL
          WHEN item ? 'allergenes_alimentaires'
          THEN NULLIF(trim(COALESCE(item->>'allergenes_alimentaires', '')), '')
          ELSE allergenes_alimentaires
        END,
        regimes_remarques = CASE
          WHEN (item ? 'decline_invitation' AND (item->>'decline_invitation')::boolean IS TRUE) THEN NULL
          WHEN item ? 'regimes_remarques'
          THEN NULLIF(trim(COALESCE(item->>'regimes_remarques', '')), '')
          ELSE regimes_remarques
        END
      WHERE id = personne_id
        AND famille_id = p_famille_id;

      IF FOUND THEN
        updated_count := updated_count + 1;
      ELSE
        errs := errs || jsonb_build_array(jsonb_build_object('personne_id', personne_id, 'error', 'not_found_or_not_belong_to_famille'));
      END IF;

    EXCEPTION WHEN others THEN
      errs := errs || jsonb_build_array(jsonb_build_object('item', item, 'error', sqlerrm));
    END;
  END LOOP;

  RETURN QUERY SELECT updated_count, errs;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_rsvp(integer, jsonb) TO anon, authenticated, service_role;
