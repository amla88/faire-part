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
    - envoie `multipart/form-data` à `POST /api/photos-upload.php`
    - headers: `x-app-token: <token invité>`
    - body: `file` + `personneId` (id de la personne sélectionnée)
  - `PhotoService.listFamilyPhotos()` (nom historique, mais scoped personne)
    - envoie `POST /api/photos-list.php`
    - headers: `x-app-token`
    - body JSON: `{ "personneId": <id> }`
  - `PhotoService.deleteFamilyPhoto(key)` (nom historique, mais scoped personne)
    - envoie `POST /api/photos-delete.php`
    - headers: `x-app-token`
    - body JSON: `{ "key": "personne-<id>/<filename>", "personneId": <id> }`
- Serveur IONOS (PHP, sous `public/api/`):
  - `photos-upload.php`:
    - valide `x-app-token` via RPC Supabase (`get_famille_by_token`)
    - vérifie que `personneId` appartient à la famille (`get_personnes_by_famille`)
    - redimensionne/convertit l’image puis écrit sous `public/assets-mariage/personne-<id>/...`
  - `photos-list.php`:
    - liste `public/assets-mariage/personne-<id>/...` et renvoie `{ items: [...] }`
  - `photos-delete.php`:
    - supprime un fichier uniquement si `key` et `personneId` correspondent et appartiennent à la famille du token

## 6) Notes
- Les images sont servies publiquement sous `https://amaurythibaud.be/assets-mariage/...`
- Les HEIC/HEIF (iPhone) sont converties côté navigateur avant upload.

