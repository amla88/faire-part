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
  - Mode “jeu vidéo” 2D (Phaser) : parcours **La Chronique du Domaine** sur `/jeu` (voir §3)
- Thème visuel (important):
  - **Référence actuelle de l’UI invité** : esthétique **Bridgerton** (régence, crème, or, en-têtes typographiques *Italiana* / *Cormorant Garamond*, cartes `bridgerton-card`, etc.) — voir § “Cohérence graphique”.
  - **À terme** : accents **geek / pixel art** (ludiques, rétro) en complément, sans casser la base élégante.

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
- Tableau de bord invité (`/dashboard`) : hero Bridgerton + résumé des réponses (`response-summary`).
- RSVP (présence / événements):
  - Route `src/app/app.routes.ts`: `/rsvp`
  - RPC `get_personnes_by_famille`
  - RPC `record_rsvp` (fallback `upsert_rsvp`)
  - Composant: `src/app/pages/rsvp/rsvp.component.ts`
- Anecdotes (plusieurs par personne, visibles uniquement pour la personne sélectionnée via RPC token) :
  - Route `/anecdotes` — `AnecdoteService` + RPC `list_anecdotes_for_token`, `insert_anecdote_for_token`, `delete_anecdote_for_token`
  - Table `personne_anecdotes` (migration `supabase/migrations/20260327120000_personne_anecdotes.sql`)
- Boîte à idées (même principe que les anecdotes, table séparée) :
  - Route `/idees` — `IdeeService` + RPC `list_idees_for_token`, `insert_idee_for_token`, `delete_idee_for_token`
  - Table `personne_idees` (migration `supabase/migrations/20260327140000_personne_idees.sql`)
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
    - Upload via API IONOS `POST /api/photos-upload.php` (avec `x-app-token` + `personneId`)
    - Liste via API IONOS `POST /api/photos-list.php` (scopée à la personne sélectionnée)
    - Suppression via API IONOS `POST /api/photos-delete.php`
  - Stockage actuel: IONOS (fichiers sous `public/assets-mariage/personne-<id>/...`)
- Musiques:
  - Route `/musiques` (menu: **Air du bal**)
  - Recherche Spotify via API PHP IONOS `POST /api/spotify-search.php`
  - Ajout possible via lien manuel (YouTube/Deezer/Apple Music/etc.)
  - Limite: **3 propositions par personne**
  - Préparation playlist: stockage d'IDs/URI Spotify + métadonnées utiles
  - Statuts affichés en français côté UI (`En attente`, `Validé`, `Refusé`)
- Profil invité:
  - Route `/profile` (depuis le menu avatar en haut à droite)
  - `nom` / `prénom` en lecture seule
  - Édition: `email`, `rue`, `numéro`, `boîte`, `code postal`, `ville`, `pays`
  - Carte intégrée de l'adresse (embed Google Maps)
  - Bloc QR personnel: aperçu, téléchargement PNG, action "Ajouter en favori"
- **Jeu 2D (Phaser) — parcours ludique** :
  - Route `/jeu`, entrée menu **Chronique pixel** ; hôte Angular : `src/app/pages/jeu/jeu.component.ts`.
  - Moteur et scènes : `src/game/` (Phaser 3) — actes 0–7, hub, `BootScene`, pont vers Supabase via `src/game/services/GameBackendBridge.ts`.
  - Progression : état local (`src/game/core/game-state.ts`) + sync JSON côté Supabase (RPC dédiées ci‑dessous).
  - RPC jeu (SECURITY DEFINER, invité) : `get_game_progress_for_token`, `upsert_game_progress_for_token`, `reset_game_progress_for_token` (migration `supabase/migrations/20260327180000_game_progress_for_token.sql`).
  - Narration / dialogues : `src/game/data/dialogues.catalog.ts` ; scénario narratif : `docs/Scénario.md` ; feuille de route production : `docs/JEU_V1_ROADMAP.md`.
  - Compte à rebours fin de parcours : meta `wedding-date-iso` (injectée par `tools/inject-env.js` depuis `WEDDING_DATE_ISO` dans `.env.local`, et en prod via le workflow GitHub si le secret est défini).

## 4) Tech stack / framework (côté app)
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

## 5) Cohérence graphique (source de vérité)
- **Ne pas** utiliser le dossier `.exemple` comme référence visuelle : il sert au plus comme **réserve technique** (patterns Angular Material, snippets) si besoin ponctuel.
- **Référence UI** : le code déjà stylé dans `src/`, en particulier :
  - Variables : `src/assets/scss/_bridgerton-tokens.scss` (`--bridgerton-cream`, `--bridgerton-gold`, `--bridgerton-ink`, etc.)
  - Cartes & cadres : `src/assets/scss/pages/_bridgerton-card.scss` (classe `.bridgerton-card`, titres `.bridgerton-card-kicker` / `.bridgerton-card-title`)
  - Exemples de pages : `dashboard`, `photo-album`, `photo-upload`, `avatar-editor`, `response-summary` / `rsvp` selon ce qui est déjà harmonisé.
- Pour toute nouvelle page ou composant invité : réutiliser ces tokens, les mêmes familles de polices (chargées globalement) et les mêmes motifs (en-tête avec “eyebrow”, filet, ornement ❦ si pertinent).

## 6) Déploiement (GitHub Actions → IONOS)
- Workflow: `.github/workflows/deploy-pages.yml`
- Déclenchement: `push` sur `main`
- Étapes clés:
  - `npm ci`
  - build prod: `npm run build -- --configuration production`
  - fallback SPA: copie `index.html` vers `404.html`
  - injection secrets Supabase dans `dist/.../browser/index.html` et `404.html` (meta tags)
  - (optionnel) injection du secret GitHub `WEDDING_DATE_ISO` en meta `wedding-date-iso` (compte à rebours dans le jeu)
  - copie des APIs PHP IONOS (`photos-*.php` + `spotify-search.php`) vers `dist/.../browser/api`
  - injection secrets Spotify dans `supabase-meta.json` au build (si fournis)
  - déploiement via SFTP/`lftp` vers IONOS (mirror sur dossier `public`)

## 7) Configuration actuelle (Supabase & injection)
- `.env.local` contient notamment:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `QR_CODE_BASE_URL`
  - `BASE_PATH`
  - (optionnel) `WEDDING_DATE_ISO` — date/heure du mariage en ISO 8601 (ex. `2026-08-30T14:00:00+02:00`) pour le compte à rebours dans le jeu (`meta name="wedding-date-iso"`)
  - (optionnel) `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` côté déploiement CI
- Injection meta tags:
  - Script: `tools/inject-env.js` (écrit `src/index.html`)
  - Puis le workflow injecte à nouveau via secrets GitHub (sed).

## 8) Accès DB: comment l’app “parle” à Supabase
- La plupart des opérations invitée passent par RPC SECURITY DEFINER:
  - `get_famille_by_token(p_token)`
  - `get_personnes_by_famille(p_famille_id)`
  - `record_rsvp(p_famille_id, p_payload)` (fallback `upsert_rsvp`)
  - `get_avatar_for_token(p_token, p_personne_id)`
  - `upsert_avatar_for_token(p_token, p_personne_id, p_seed, p_options)`
  - `list_musiques_for_token(p_token, p_personne_id)`
  - `insert_musique_for_token(...)`
  - `delete_musique_for_token(p_token, p_musique_id)`
  - `get_profile_for_token(p_token, p_personne_id)`
  - `update_profile_for_token(p_token, p_personne_id, ...)`
  - **Progression jeu** : `get_game_progress_for_token(p_token, p_personne_id)`, `upsert_game_progress_for_token(...)`, `reset_game_progress_for_token(...)`
- Quelques accès directs:
  - tableaux `familles`, `personnes` etc via le client Supabase côté admin.

## 9) Stockage images: points techniques importants
- L’API PHP IONOS (`public/api/`) :
  - valide le token via RPC `get_famille_by_token`
  - vérifie que `personneId` appartient à la famille (`get_personnes_by_famille`)
  - stocke sous `assets-mariage/personne-<id>/<timestamp>_<rand>_<hash>.webp` (ou `.jpg` fallback)
  - renvoie au front une URL publique `https://amaurythibaud.be/assets-mariage/...`
  - redimensionne et ré-encode (suppression des métadonnées)
  - HEIC/HEIF est converti côté navigateur avant envoi (front)

## 10) Exclusions / conventions pour Cursor
- Ne pas modifier le dossier **`.exemple`** sauf besoin explicite de copier une **technique** (composant Material, pattern de code) ; ce n’est **pas** le gabarit graphique du produit.
- Respecter l’existant: Angular Material, conventions routes, protections `AuthGuard` / `adminGuard`.
- Pour l’UI invité, **s’aligner sur le style Bridgerton déjà présent dans `src/`** (tokens + cartes + pages de référence ci‑dessus), pas sur `.exemple`.
- Priorité aux intégrations “câblées” (front ↔ RPC/edge functions ↔ UI).
