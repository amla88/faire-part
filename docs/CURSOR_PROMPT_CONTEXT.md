# Contexte projet (à coller dans Cursor)

## 1) Résumé métier
- Projet: `faire-part` — faire‑part de mariage (site web + pages invités).
- Objectif: après connexion d’un invité (par lien + code, ou QR/“quick login”), l’invité doit pouvoir envoyer ses réponses (présence/non) et des informations complémentaires.
- Infos à collecter (cible produit):
  - RSVP (présence/non) pour plusieurs événements
  - Avatar personnalisé
  - Photo de nous (compromettante ou non) + éventuellement une zone de modération
  - Musiques (1 à 3 propositions)
  - Allergènes / préférences alimentaires
  - Anecdote / texte libre
  - Boîte à idées (messages libres)
  - (Option) un mode “jeu vidéo” 2D (Phaser) pour remplir les infos de manière ludique
- Thème visuel (important):
  - Mariage basé sur `Bridgerton` (esthétique “régence”, élégante)
  - + `geek / pixel art` (éléments ludiques, style rétro, UI “pixel” ou accents pixel)

## 2) Choix d’UX / produit
- L’UX invite doit offrir 2 modes:
  - Mode rapide: formulaire simple
  - Mode ludique: parcours via jeu 2D (Phaser) + “scénario”
- L’app est un petit projet privé: éviter la sur‑ingénierie, et privilégier les changements minimaux et cohérents avec le code existant.
- Ne pas ajouter de tests unitaires si ce n’est pas demandé (petit projet privé).

## 3) Ce qui est déjà implémenté (état actuel du repo)
- Auth invités:
  - Routes:
    - `src/app/pages/authentication/authentication.routes.ts`
    - `/authentication/login`
    - `/authentication/quick/:code` via `QuickLoginGuard`
  - Le “code” est normalisé en `^[A-Z0-9]{8}$`.
  - Connexion via Supabase + stockage `localStorage`:
    - `app_user` (user/cache)
    - `app_token` (token invité)
- RSVP (présence / événements):
  - Route `src/app/app.routes.ts`: `/rsvp`
  - RPC `get_personnes_by_famille`
  - RPC `record_rsvp` (fallback `upsert_rsvp`)
  - Composant: `src/app/pages/rsvp/rsvp.component.ts`
- Avatar:
  - Route `/avatar` protégée (`AuthGuard`)
  - Composant: `src/app/pages/avatar/avatar-editor.component.ts`
  - Génération d’avatar via DiceBear `@dicebear/collection` + `@dicebear/core` (`avataaars`)
  - Sauvegarde: `AvatarService.saveAvatar()` appelle RPC `upsert_avatar_for_token`
- Photos:
  - Routes:
    - `/photos/upload` → `PhotoUploadComponent`
    - `/photos/album` → `PhotoAlbumComponent`
  - Front:
    - `src/app/services/photo.service.ts`
    - Upload via Edge Function `upload-photo`
    - Liste via Edge Function `list-photos`
  - Edge Functions (Deno):
    - `supabase/functions/upload-photo/index.ts`
    - `supabase/functions/list-photos/index.ts`
  - Stockage actuel: Object Storage Oracle (S3-compatible) via signature SigV4 dans les edge functions.

## 4) Techtack / framework (côté app)
- Frontend:
  - Angular 20 (standalone components/routes)
  - Angular Material + Angular CDK
  - Router: configuration dans `src/app/app.routes.ts`
  - ChangeDetection: souvent `OnPush`
- Avatar:
  - DiceBear `avataaars`
- Photos:
  - Edge Functions Supabase (Deno + `jsr:@supabase/...`)
  - Supabase client `@supabase/supabase-js` côté front

## 5) Déploiement (GitHub Actions → IONOS)
- Workflow: `.github/workflows/deploy-pages.yml`
- Déclenchement: `push` sur `main`
- Étapes clés:
  - `npm ci`
  - build prod: `npm run build -- --configuration production`
  - fallback SPA: copie `index.html` vers `404.html`
  - injection secrets Supabase dans `dist/.../browser/index.html` et `404.html` (meta tags)
  - déploiement via SFTP/`lftp` vers IONOS (mirror sur dossier `public`)

## 6) Configuration actuelle (Supabase & injection)
- `.env.local` contient notamment:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `QR_CODE_BASE_URL`
  - `BASE_PATH`
- Injection meta tags:
  - Script: `tools/inject-env.js` (écrit `src/index.html`)
  - Puis le workflow injecte à nouveau via secrets GitHub (sed).

## 7) Accès DB: comment l’app “parle” à Supabase
- La plupart des opérations invitée passent par RPC SECURITY DEFINER:
  - `get_famille_by_token(p_token)`
  - `get_personnes_by_famille(p_famille_id)`
  - `record_rsvp(p_famille_id, p_payload)` (fallback `upsert_rsvp`)
  - `get_avatar_for_token(p_token, p_personne_id)`
  - `upsert_avatar_for_token(p_token, p_personne_id, p_seed, p_options)`
- Quelques accès directs:
  - tableaux `familles`, `personnes` etc via le client Supabase côté admin.

## 8) Stockage images: points techniques importants
- Les edge functions:
  - valident le token via RPC `get_famille_by_token`
  - calculent `familleId`
  - construisent une clé: `famille-<id>/<timestamp>-<rand>.<ext>`
  - signent et font un `PUT` S3-compatible vers l’Object Storage Oracle (ou listing via S3 list)
  - renvoient au front un `publicUrl` basé sur `PUBLIC_BASE_URL` (si fournie)

## 9) Exclusions / conventions pour Cursor
- Ne pas modifier `/.exemple` (référence design seulement).
- Respecter l’existant: Angular Material, conventions routes, protections `AuthGuard` / `adminGuard`.
- En cas de besoin UI, s’aligner sur le style des composants et boutons du projet `.exemple` (sans changer ses fichiers).
- Priorité aux intégrations “câblées” (front ↔ RPC/edge functions ↔ UI).

