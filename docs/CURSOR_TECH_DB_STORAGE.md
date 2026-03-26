# Contexte technique (DB + Storage) — à coller dans Cursor

## 1) Projet Supabase (identité & scope)
- Supabase project (hébergé): `Faire-Part`
- `project_id`: `hgphrkeajnxnymaqndrf`
- Schéma utilisé: `public`

## 2) Tables principales détectées (lecture)
- `public.familles`
- `public.personnes`
- `public.avatars`
- `public.musiques`
- `public.audit_log`
- `public.app_secrets`

## 3) Fonctions (RPC / SECURITY DEFINER) utilisées par l’app
- Auth / token:
  - `public.get_famille_by_token(p_token text)` (SECURITY DEFINER)
  - `public.get_personnes_by_famille(p_famille_id bigint)` (SECURITY DEFINER)
- RSVP:
  - `public.record_rsvp(p_famille_id integer, p_payload jsonb)`
  - `public.upsert_rsvp(...)` (fallback côté front)
- Avatar:
  - `public.get_avatar_for_token(p_token text, p_personne_id bigint)`
  - `public.upsert_avatar_for_token(p_token text, p_personne_id bigint, p_seed text, p_options jsonb)`
- Notes:
  - Les edge functions photos valident le token via `get_famille_by_token`.

## 4) RLS et policies (important)
- RLS est activé sur les tables listées.
- Les policies doivent être cohérentes avec les rôles attendus:
  - invité: `anon` / `authenticated` via login token
  - admin: accès admin authentifié (via Supabase Auth)
  - edge functions: utilisent des clés `SERVICE_ROLE_KEY` côté Deno (donc peuvent contourner l’accès direct, selon config)

## 5) Storage photos (actuel)
- Front:
  - `PhotoService.uploadGuestPhoto(file)`
    - envoie `multipart/form-data` à:
      - `${SUPABASE_URL}/functions/v1/upload-photo`
    - headers:
      - `Authorization: Bearer <SUPABASE_ANON_KEY>` (actuel code)
      - `apikey: <SUPABASE_ANON_KEY>`
      - `x-app-token: <token invité>`
  - `PhotoService.listFamilyPhotos()`
    - envoie `POST` à:
      - `${SUPABASE_URL}/functions/v1/list-photos`
    - body `{}` + `x-app-token`.
- Edge function `upload-photo`:
  - attend `x-app-token`
  - valide via RPC `get_famille_by_token`
  - upload vers un endpoint S3-compatible (Oracle Object Storage) via SigV4
  - construit URL publique via `PUBLIC_BASE_URL`
- Edge function `list-photos`:
  - valide token via `get_famille_by_token`
  - fait un listing S3 (ListObjectsV2) signé et renvoie une liste d’objets

## 6) Objectif futur (IONOS)
- Tu veux stocker les images sur ton serveur/stockage IONOS (250GB).
- Pour le remplacer proprement:
  - garder le même “contrat” (mêmes requêtes/headers edge ↔ front)
  - substituer le provider S3-compatible dans `upload-photo`/`list-photos`
    - si IONOS fournit un endpoint S3 compatible: c’est surtout un changement de secrets + endpoint publicUrl
    - sinon: il faudra adapter les signatures/URL et éventuellement la stratégie (PAR / upload direct)

