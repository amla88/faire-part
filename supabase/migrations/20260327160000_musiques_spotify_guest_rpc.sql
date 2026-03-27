-- Métadonnées Spotify pour export playlist + RPC invité (max 3 titres par personne).

ALTER TABLE public.musiques
  ADD COLUMN IF NOT EXISTS spotify_track_id text,
  ADD COLUMN IF NOT EXISTS spotify_uri text,
  ADD COLUMN IF NOT EXISTS album_name text,
  ADD COLUMN IF NOT EXISTS album_image_url text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS artists_json jsonb;

COMMENT ON COLUMN public.musiques.spotify_track_id IS 'Identifiant track Spotify (pour playlist / dédoublonnage).';
COMMENT ON COLUMN public.musiques.spotify_uri IS 'URI spotify:track:…';
COMMENT ON COLUMN public.musiques.artists_json IS 'Liste d’artistes (JSON), complément du champ auteur.';

CREATE UNIQUE INDEX IF NOT EXISTS musiques_personne_spotify_unique
  ON public.musiques (personne_id, spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

-- --- list ---

CREATE OR REPLACE FUNCTION public.list_musiques_for_token(p_token text, p_personne_id bigint)
 RETURNS TABLE(
   id bigint,
   created_at timestamptz,
   titre text,
   auteur text,
   lien text,
   commentaire text,
   status text,
   spotify_track_id text,
   spotify_uri text,
   album_name text,
   album_image_url text,
   duration_ms integer,
   preview_url text,
   artists_json jsonb
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
    m.id,
    m.created_at,
    m.titre,
    m.auteur,
    m.lien,
    m.commentaire,
    m.status,
    m.spotify_track_id,
    m.spotify_uri,
    m.album_name,
    m.album_image_url,
    m.duration_ms,
    m.preview_url,
    m.artists_json
  FROM public.musiques m
  WHERE m.personne_id = p_personne_id
  ORDER BY m.created_at DESC;
END;
$function$;

-- --- insert (max 3 par personne) ---

CREATE OR REPLACE FUNCTION public.insert_musique_for_token(
  p_token text,
  p_personne_id bigint,
  p_titre text,
  p_auteur text,
  p_lien text,
  p_commentaire text,
  p_spotify_track_id text,
  p_spotify_uri text,
  p_album_name text,
  p_album_image_url text,
  p_duration_ms integer,
  p_preview_url text,
  p_artists_json jsonb
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fam public.familles%ROWTYPE;
  v_cnt int;
  v_id bigint;
  v_titre text;
  v_auteur text;
  v_lien text;
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

  v_titre := trim(COALESCE(p_titre, ''));
  v_auteur := trim(COALESCE(p_auteur, ''));
  v_lien := trim(COALESCE(p_lien, ''));

  IF length(v_titre) = 0 OR length(v_auteur) = 0 OR length(v_lien) = 0 THEN
    RAISE EXCEPTION 'empty_fields';
  END IF;

  SELECT COUNT(*)::int INTO v_cnt FROM public.musiques WHERE personne_id = p_personne_id;
  IF v_cnt >= 3 THEN
    RAISE EXCEPTION 'musique_limit_reached';
  END IF;

  IF p_spotify_track_id IS NOT NULL AND length(trim(p_spotify_track_id)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.musiques m
      WHERE m.personne_id = p_personne_id
        AND m.spotify_track_id = trim(p_spotify_track_id)
    ) THEN
      RAISE EXCEPTION 'duplicate_track';
    END IF;
  END IF;

  INSERT INTO public.musiques (
    personne_id,
    titre,
    auteur,
    lien,
    commentaire,
    status,
    spotify_track_id,
    spotify_uri,
    album_name,
    album_image_url,
    duration_ms,
    preview_url,
    artists_json
  )
  VALUES (
    p_personne_id,
    v_titre,
    v_auteur,
    v_lien,
    COALESCE(trim(p_commentaire), ''),
    'pending',
    NULLIF(trim(p_spotify_track_id), ''),
    NULLIF(trim(p_spotify_uri), ''),
    NULLIF(trim(p_album_name), ''),
    NULLIF(trim(p_album_image_url), ''),
    p_duration_ms,
    NULLIF(trim(p_preview_url), ''),
    p_artists_json
  )
  RETURNING musiques.id INTO v_id;

  RETURN v_id;
END;
$function$;

-- --- delete (pending only) ---

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
    AND m.status = 'pending'
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

GRANT EXECUTE ON FUNCTION public.list_musiques_for_token(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.list_musiques_for_token(text, bigint) TO authenticated;

GRANT EXECUTE ON FUNCTION public.insert_musique_for_token(
  text, bigint, text, text, text, text,
  text, text, text, text, integer, text, jsonb
) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_musique_for_token(
  text, bigint, text, text, text, text,
  text, text, text, text, integer, text, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_musique_for_token(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_musique_for_token(text, bigint) TO authenticated;
