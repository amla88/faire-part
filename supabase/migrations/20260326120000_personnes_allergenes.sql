-- Registre culinaire : allergies et remarques par personne (invités via record_rsvp).

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS allergenes_alimentaires text,
  ADD COLUMN IF NOT EXISTS regimes_remarques text;

COMMENT ON COLUMN public.personnes.allergenes_alimentaires IS
  'Allergènes et intolérances alimentaires déclarés par l''invité (texte libre).';
COMMENT ON COLUMN public.personnes.regimes_remarques IS
  'Régimes (végétarien, halal, etc.), préférences ou autres précisions pour le traiteur.';

-- Impossible de changer le type de retour (colonnes) avec CREATE OR REPLACE seul (42P13).
DROP FUNCTION IF EXISTS public.get_personnes_by_famille(bigint);

CREATE OR REPLACE FUNCTION public.get_personnes_by_famille(p_famille_id bigint)
 RETURNS TABLE(
   id bigint,
   nom text,
   prenom text,
   invite_reception boolean,
   present_reception boolean,
   invite_repas boolean,
   present_repas boolean,
   invite_soiree boolean,
   present_soiree boolean,
   allergenes_alimentaires text,
   regimes_remarques text
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.nom,
    p.prenom,
    COALESCE(p.invite_reception, false)    AS invite_reception,
    COALESCE(p.present_reception, false)   AS present_reception,
    COALESCE(p.invite_repas, false)        AS invite_repas,
    COALESCE(p.present_repas, false)       AS present_repas,
    COALESCE(p.invite_soiree, false)       AS invite_soiree,
    COALESCE(p.present_soiree, false)      AS present_soiree,
    p.allergenes_alimentaires,
    p.regimes_remarques
  FROM public.personnes p
  WHERE p.famille_id = p_famille_id
  ORDER BY p.id;
$function$
;

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
        present_reception = CASE WHEN item ? 'present_reception' THEN (item->>'present_reception')::boolean ELSE present_reception END,
        present_repas     = CASE WHEN item ? 'present_repas'     THEN (item->>'present_repas')::boolean     ELSE present_repas     END,
        present_soiree    = CASE WHEN item ? 'present_soiree'    THEN (item->>'present_soiree')::boolean    ELSE present_soiree    END,
        allergenes_alimentaires = CASE
          WHEN item ? 'allergenes_alimentaires'
          THEN NULLIF(trim(COALESCE(item->>'allergenes_alimentaires', '')), '')
          ELSE allergenes_alimentaires
        END,
        regimes_remarques = CASE
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
$function$
;
