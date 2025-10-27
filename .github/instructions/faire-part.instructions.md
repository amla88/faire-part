---
applyTo: '**'
---
# Contexte fonctionnel et technique (à épingler dans Copilot Chat)

Résumé
- Faire-part de mariage en deux parties: Admin (gestion/analytique) et Invités (accès via QR/code, mini‑jeu 2D type RPG SNES, création d’avatar, RSVP, photos/musiques).
- Back-end: Supabase (DB Postgres, Auth, Storage, RPC). Front actuel: Angular 18 standalone + Phaser 3, Angular Material (UI), hash‑routing.
- Déploiement: GitHub Pages sous le chemin /faire-part.

1) Partie Administrateur
- Gérer les invités et familles: créer/éditer/supprimer (flux basique présent), possibilité d’ajout avec token d’accès et lien dédié.
- Statistiques: section prévue avec agrégats RSVP/photos/musiques (service et page présents, selon disponibilité côté DB/RPC).
- Gestion des accès: génération de liens d’accès (token) et ouverture directe du jeu pour un invité; rotation/suppression à implémenter selon besoins.
- Modération contenus: approbation/rejet/suppression des photos et musiques proposés par les invités.
- Gestion du jeu: à venir (textes PNJ, objectifs/checklist, configuration des salles/pièces).

2) Partie Invités (expérience)
- Connexion: scan QR ou lien contenant un uuid (query/hash). Pas de mot de passe.
- Mini‑jeu 2D (Phaser): déplacement, collision, PNJ, transitions de pièces.
- Avatar personnel: éditeur dicebear avec une bibliothèque personnalisée. Persistance des choix. Aperçu en temps réel. utilises le mpc context7 pour la documentation.
- Multi‑membres par famille: sélection d’un membre (personne) et possibilité de changer à tout moment.
- Interactions disponibles:
  - Proposer des musiques (texte/liens Spotify/YouTube/Deezer/autres).
  - Envoyer des photos souvenirs (upload → modération admin).
  - Confirmer la présence (RSVP) selon l’invitation.
  - Éditeur d’avatar avec aperçu par superposition d’images.

Parcours utilisateur (simplifié)
1. Reçoit une invitation avec QR + token. 2. Ouvre l’app → token capté (query/hash/localStorage) → session invitée. 3. Choisit la personne. 4. Explore le jeu, configure l’avatar. 5. Dépose photos / propose musiques. 6. Remplit RSVP. 7. Peut revenir plus tard pour modifier.

Pile actuelle (Front)
- Angular 18 standalone, Angular Router en mode hash (compat GitHub Pages), Angular Material + CDK pour l’UI.
- Phaser 3 intégré nativement via un composant Angular.
- Supabase JS v2.55 (client singleton).
- Thème: Material prebuilt (indigo-pink) importé; utilitaires CSS possibles (Tailwind si configuré).

Sécurité et conformité
- Tokens de connexion (QR/lien) persistés localement pour fluidifier la session; rotation/expiration côté back recommandée.
- RLS Supabase strict à implémenter/valider: accès limité par famille; usage de RPC SECURITY DEFINER pour opérations transverses (lookup par token, upsert choix avatar, RSVP, uploads).
- Modération: workflow pour photos/musiques; limites taille/format; éventuel rate limiting (table throttle/RPC ou edge functions).
- Vie privée: pas d’exposition d’emails/téléphones entre invités; anonymiser les statistiques.

Base de données (proposition)
- familles(id, nom_famille, note_admin)
- personnes(id, famille_id FK, prenom, nom, role, …)
- invitations(id, famille_id FK, type_invitation ENUM[apero,repas,soiree,combi], message)
- users(id, famille_id FK, login_token, short_code UNIQUE, token_expires_at, last_login_at)
- rsvp(id, famille_id FK, pour_apero BOOL, pour_repas BOOL, pour_soiree BOOL, contraintes_text, updated_at)
- avatars(id, personne_id FK UNIQUE, meta JSONB)
- avatar_assets(id UUID, category, label, storage_path, depth INT, order_index INT, enabled BOOL)
- avatar_asset_choices(avatar_id FK, category, asset_id FK, PRIMARY KEY(avatar_id, category))
- photos(id, famille_id FK, storage_path, created_at, status ENUM[pending,approved,rejected], caption)
- musiques(id, famille_id FK, source ENUM[text,spotify,youtube,deezer,autre], value TEXT, created_at, status ENUM[pending,approved,rejected])
- rooms(id, slug UNIQUE, title, order_index)
- dialogues(id, room_id FK, npx_id?, text, objective_id?, order_index)
- objectives(id, code UNIQUE, label, room_id FK, reward?)
- players(id, user_id FK, save_data JSONB)

RPC recommandées (SECURITY DEFINER)
- get_user_by_token(p_token text) → users row sécurisé (login QR/lien)
- ensure_avatar_for_personne(p_personne_id int) → avatars row (create-or-return)
- upsert_avatar_choices(p_personne_id int, p_selections jsonb)
- submit_photo(p_famille_id int, p_file_path text) → photos
- submit_music(p_famille_id int, p_source text, p_value text) → musiques
- record_rsvp(p_famille_id int, p_payload jsonb) → rsvp
- exchange_short_code_for_token(p_code text) → token + expiration (optionnel)
- rotate_token(p_user_id int) → nouveau token/QR (optionnel)
- get_stats_admin() → agrégats RSVP/photos/musiques

Storage (Cloud oracle - always free)
- Nom du buckets: assets-mariage
- Lien publique: https://axadzdd2ubpq.objectstorage.eu-paris-1.oci.customer-oci.com/n/axadzdd2ubpq/b/assets-mariage/o/

Jeu (Phaser) – principes
- Config: 360×240, pixelArt, Scale.FIT, CENTER_BOTH; physics arcade (no gravity).
- Scene: MainScene; services InputService, UIService, ChecklistService.
- PNJ/pièces: overlap → action → dialogue → objectifs; triggers pour transitions.

Éditeur d’avatar
- Assets par catégories (ex: skin, hair_style, hair_color, eyes, face_shape, nose_shape, mouth_shape, facial_hair, accessory, hat, top, bottom), triés par depth.
- Preview par superposition d’images; export PNG local possible.
- Persistance: avatar par personne; choix dans avatar_asset_choices; URLs publiques depuis Storage.

Configuration Supabase (Front)
- Service: `NgSupabaseService` (singleton) lit en priorité les variables d’environnement (`src/environments/environment*.ts`), puis les meta tags dans `index.html`:
  - meta name="supabase-url"
  - meta name="supabase-anon-key"
- En prod, préférer le build avec file replacement et variables d’environnement. Les meta servent de fallback (utile en dev/local ou sandbox).

Routing (Angular, hash‑based)
- Routes principales (avec guards admin/guest selon le cas):
  - `/` Accueil
  - `/login` Login invité (token)
  - `/admin-login` Login admin
  - `/rsvp` Formulaire RSVP (guest)
  - `/music` Propositions de musiques (guest)
  - `/photos/upload` Upload photos (guest)
  - `/photos` Galerie photos (guest)
  - `/avatar` Éditeur d’avatar (guest)
  - `/person` Sélecteur de personne (guest)
  - `/game` Jeu (Phaser) intégré nativement (guest)
  - `/admin` Tableau admin (liens, stats)
  - `/admin/assets` Gestion des assets d’avatar (admin)
  - `/admin/music` Modération musiques (admin)
  - `/admin/photos` Modération photos (admin)

Commandes utiles
- Dev (serveur local):
  - `npm start`
- Build (base href ajustée pour /faire-part) + fallback SPA:
  - `npm run build` (génère `dist/` et copie `dist/index.html` → `dist/404.html`)
- Déploiement GitHub Pages:
  - `npm run deploy` (publie `dist/`)

Déploiement (GitHub Pages)
- Base href: `ng build --base-href=/faire-part/` (déjà dans le script build).
- Router en mode hash (`withHashLocation`) pour compat SPA sur GH Pages.
- Copier `index.html` → `404.html` pour permettre le fallback des routes.

Notes UI
- Angular Material utilisé comme base (toolbar, cards, form-field/inputs, selects, tables, buttons, icons, snack-bar, progress-bar).
- Thème Material pré-construit (indigo-pink) importé dans `src/styles.css`.
- Utilitaires CSS (Tailwind) optionnels: activés si un `tailwind.config.js` est présent; sinon ignorés.

Parles-moi toujours en français.