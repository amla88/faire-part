-- Invitations / présence « anniversaire » par personne (admin + RSVP invité).

ALTER TABLE public.personnes
  ADD COLUMN IF NOT EXISTS invite_anniversaire boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS present_anniversaire boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personnes.invite_anniversaire IS
  'Convocation à l’événement anniversaire (hors réception/repas/soirée du mariage).';
COMMENT ON COLUMN public.personnes.present_anniversaire IS
  'Intention de présence à l’anniversaire (si invité).';

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
   invite_anniversaire boolean,
   present_anniversaire boolean,
   decline_invitation boolean,
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
    COALESCE(p.invite_anniversaire, false) AS invite_anniversaire,
    COALESCE(p.present_anniversaire, false) AS present_anniversaire,
    COALESCE(p.decline_invitation, false)  AS decline_invitation,
    p.allergenes_alimentaires,
    p.regimes_remarques
  FROM public.personnes p
  WHERE p.famille_id = p_famille_id
  ORDER BY p.id;
$function$;

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
