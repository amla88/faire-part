```instructions
Connexion à la db par le mcp supabase.
Quand la structure de la base évolue, merci de mettre à jour ce document. Il sert de référence rapide pour les développeurs qui travaillent sur les RPC, l'auth et les règles RLS.

## Tables (extrait de la base actuelle)

Les tables principales utilisées par l'application :

- public.avatar_asset_choices
- public.avatar_assets
- public.avatars
- public.familles
- public.musiques
- public.personnes
- public.profiles

> Les définitions de colonnes détaillées (types / defaults) sont disponibles dans la console Supabase. Ci‑dessous figure un résumé utile — tenir à jour après tout changement de schéma.

### public.familles (colonnes clés)
- id : bigint (PK)
- created_at : timestamptz (default now())
- personne_principale : bigint (FK → personnes)
- connexion : timestamptz
- auth_uuid : uuid
- login_token : text (token d'accès pour les invités)
- is_admin : boolean (flag admin au niveau famille)
- created_by : uuid (user/admin qui a créé l'enregistrement)
- adresse : (rue, numero, boite, cp, ville, pays)

### public.personnes (colonnes clés)
- id : bigint (PK)
- created_at : timestamptz
- nom, prenom : text
- famille_id : bigint (FK → familles)
- email : text
- present_reception / present_repas / present_soiree : boolean
- invite_pour : enum (ex: 'soirée')

### public.musiques
- id, created_at, titre, auteur, lien, commentaire, personne_id

### public.avatars / public.avatar_assets / public.avatar_asset_choices
- Tables pour gérer les assets d'avatar, la sélection par personne et la composition (depth/order)

## RPC (fonctions stockées) — existantes

Les RPC découvertes via MCP Supabase (schéma `public`) :

- get_user_by_token
- get_famille_by_token
- list_personnes_by_token
- ensure_avatar_for_personne
- upsert_avatar_choices
- submit_music
- set_music_status
- submit_photo
- set_photo_status
- get_stats_admin
- get_admin_stats
- mcp_list_tables
- mcp_describe_table
- is_admin
- current_user_uuid
- trigger_set_updated_at
- tg_set_updated_at

Exemples d'appel :

```sql
-- SQL direct
SELECT * FROM get_user_by_token('LE_TOKEN');
SELECT * FROM get_famille_by_token('LE_TOKEN');
```

```ts
// Avec Supabase JS (NgSupabaseService.getClient())
const client = ngSupabaseService.getClient();
const { data, error } = await client.rpc('get_user_by_token', { p_token: 'LE_TOKEN' });
```

> Remarque : certaines fonctions peuvent avoir des overloads. Utiliser `mcp_describe_table` / `mcp_list_tables` pour l'introspection rapide.

## RLS (Row Level Security) — politiques actives (résumé)

Les données suivantes proviennent de la vue `pg_policies` pour le schéma `public`. Elles contrôlent l'accès en lecture/écriture au niveau ligne.

- `audit_log` — `audit_log_admin_only` : restreint l'accès aux administrateurs (condition `is_admin()`).

- `avatar_asset_choices` :
  - `avatar_asset_choices_admin_write` : écriture limitée aux admins (via `profiles.role = 'admin'`).
  - `avatar_asset_choices_public_read` : lecture publique.

- `avatar_assets` :
  - `avatar_assets_admin_write` : écriture par admin.
  - `avatar_assets_public_read` : lecture publique.

- `avatars` :
  - `Avatars: lecture par famille ou admin` : lecture si la personne appartient à la même famille (jointure personnes→familles) ou si le JWT a le rôle `admin`.
  - `Avatars: modification par famille ou admin` : modification autorisée sous les mêmes conditions.

- `familles` (important pour l'auth via token) :
  - `Admin peut DELETE` : suppression réservée aux admins (`profiles.role = 'admin'`).
  - `Allow admin insert` : insert autorisé aux admins.
  - `Lecture admin ou token` : lecture autorisée si l'une des conditions est vraie :
    - l'utilisateur est admin (`profiles.role = 'admin'`),
    - ou `login_token` = claim JWT `uuid` (comparaison via `current_setting('request.jwt.claims', true)::json ->> 'uuid'`),
    - ou `auth_uuid = auth.uid()` (famille liée à l'utilisateur authentifié).
  - `admin all update` : mises à jour réservées aux admins.

- `musiques` :
  - `Musiques: insertion par famille` : insert autorisé si la personne appartient à la même famille (contrôle via personnes.famille_id et f.auth_uuid = auth.uid()).
  - `Musiques: lecture par famille ou admin` : lecture si famille correspondante ou admin.
  - `Musiques: modification/suppression par admin` : update/delete réservés aux admins.
  - `admin_all_musiques` : règle additionnelle pour admins authentifiés.

- `personnes` :
  - `Admin peut SELECT` : select autorisé aux admins.
  - `Allow admin insert` : insert autorisé aux admins.

- `photos` :
  - `admin_all_photos` : accès/admin rights pour les photos.

- `profiles` :
  - `Allow user read own profile` : lecture autorisée uniquement si `id = auth.uid()`.

Remarques générales sur la RLS :

- Les policies s'appuient beaucoup sur la table `profiles` et sur les helpers `auth.uid()` et `auth.jwt()` pour différencier admins et utilisateurs.
- La policy `Lecture admin ou token` sur `familles` est cruciale pour le flux de connexion via `login_token` : elle permet la lecture d'une ligne `familles` si le token envoyé figure dans les claims JWT (ou si `auth_uuid` correspond).

## Points d'attention pour les développeurs

- `familles.login_token` est utilisé comme un mécanisme d'accès rapide (8 caractères). Toute vérification côté client doit appeler les RPC appropriés (`get_user_by_token` / `get_famille_by_token`) ou s'appuyer sur la RLS via les clés d'authentification standard — ne pas utiliser `service_role` côté client.
- Pour toute modification de RLS ou des RPC, mettez à jour ce document et prévenez l'équipe : ces règles affectent la sécurité et les accès en production.
- Les RPC `mcp_list_tables` / `mcp_describe_table` sont disponibles dans la DB et utiles pour l'introspection par les outils ou scripts d'automatisation.

---

_Document mis à jour automatiquement via MCP Supabase le :_ `2025-10-24T17:06:00Z`

Parles-moi toujours en français.

```
```instructions
Connexion à la db par le mcp supabase.

Quand la structure de la base évolue, merci de mettre à jour ce document. Il sert de référence rapide pour les développeurs qui travaillent sur les RPC, l'auth et les règles RLS.

## Tables (extrait de la base actuelle)

Les tables principales utilisées par l'application :

- public.avatar_asset_choices
- public.avatar_assets
- public.avatars
- public.familles
- public.musiques
- public.personnes
- public.profiles

> Les définitions de colonnes détaillées (types / defaults) sont conservées dans le schéma SQL. Ci‑dessous figure un résumé utile — voir la console Supabase pour le schéma complet si besoin.

### public.familles (colonnes clés)
- id : bigint (PK)
- created_at : timestamptz (default now())
- personne_principale : bigint (FK → personnes)
- connexion : timestamptz
- auth_uuid : uuid
- login_token : text (token d'accès pour les invités)
- is_admin : boolean (flag admin au niveau famille)
- created_by : uuid (user/admin qui a créé l'enregistrement)
- adresse : (rue, numero, boite, cp, ville, pays)

### public.personnes (colonnes clés)
- id : bigint (PK)
- created_at : timestamptz
- nom, prenom : text
- famille_id : bigint (FK → familles)
- email : text
- present_reception / present_repas / present_soiree : boolean
- invite_pour : enum (ex: 'soirée')

### public.musiques
- id, created_at, titre, auteur, lien, commentaire, personne_id

### public.avatars / public.avatar_assets / public.avatar_asset_choices
- Tables pour gérer les assets d'avatar, la sélection par personne et la composition (depth/order)

## RPC (fonctions stockées) — existantes / recommandées

Voici les RPC connues ou fortement recommandées pour cette application. Certaines existent déjà sur la DB; d'autres sont des propositions à implémenter côté Postgres (SECURITY DEFINER pour les opérations sensibles).

- get_user_by_token(p_token text) RETURNS familles row
  - Usage : lookup d'une `famille` via le token embarqué dans le QR / lien d'invitation. Doit être SECURITY DEFINER + RLS-aware (retourner uniquement les colonnes nécessaires).

- ensure_avatar_for_personne(p_personne_id bigint) RETURNS avatars row
  - Usage : create-or-return l'avatar pour une personne (utilisé par l'éditeur d'avatar).

- upsert_avatar_choices(p_personne_id bigint, p_selections jsonb) RETURNS void
  - Usage : persister les choix d'assets (avatar_asset_choices) atomiquement.

- submit_photo(p_famille_id bigint, p_file_path text) RETURNS photos row
  - Usage : créer l'enregistrement photos en attendant la modération; peut déclencher un workflow de modération.

- submit_music(p_famille_id bigint, p_source text, p_value text) RETURNS musiques row
  - Usage : création d'une proposition de musique (status pending).

- record_rsvp(p_famille_id bigint, p_payload jsonb) RETURNS rsvp row
  - Usage : enregistre ou met à jour la réponse RSVP pour la famille.

- exchange_short_code_for_token(p_code text) RETURNS record (token text, expires_at timestamptz)
  - Usage : convertir un code court en token long (si vous supportez short codes).

- rotate_token(p_famille_id bigint) RETURNS text
  - Usage : rotation/regenération du login_token (admin).

- get_stats_admin() RETURNS jsonb
  - Usage : regrouper les agrégats (nbr RSVP, photos pending, musiques pending, taux de participation).

Remarques :
- Les RPC qui exposent des données utilisateur doivent être marquées SECURITY DEFINER et filtrer/masquer les données sensibles.
- Pour les RPC utilisées côté client (avec la clef anon), veillez à n'exposer que les colonnes nécessaires.

## RLS (Row Level Security) — règles et bonnes pratiques

L'application doit reposer sur des politiques RLS strictes côté Supabase pour garantir que :
- un invité ne peut lire que sa `famille` / ses `personnes` / ses `photos` tant que la modération/partage ne l'autorise pas ;
- un admin (role admin) peut effectuer des opérations de modération et lecture globale ;
- les opérations de création qui doivent être publiques (ex : upload d'avatar assets) sont explicitement autorisées par policy.

Exemples de policies (à adapter selon votre schéma JWT et claims) :

1) Table `familles` — lecture par owner/admin via auth.uid() (si authentification via Supabase Auth)

-- autoriser SELECT si l'utilisateur est le créateur (created_by) ou a un rôle admin
-- Exemple SQL :
-- CREATE POLICY "select_famille_owner_or_admin" ON public.familles
--   FOR SELECT USING (
--     auth.uid() IS NOT NULL AND (
--       created_by = auth.uid()
--       OR (current_setting('jwt.claims.is_admin', true) = 'true')
--     )
--   );

2) Table `personnes` — lecture/écriture si la personne appartient à la famille de l'utilisateur

-- CREATE POLICY "personnes_for_family" ON public.personnes
--   FOR ALL USING (
--     (EXISTS (SELECT 1 FROM public.familles f WHERE f.id = personne.famille_id AND f.created_by = auth.uid()))
--   );

3) Table `photos` — insert autorisé via RPC ou via policy qui vérifie un token temporaire

-- Exemple (insert via RPC recommandé) :
-- REVOKE ALL ON photos FROM public;
-- CREATE POLICY "insert_photos_via_rpc_or_owner" ON public.photos
--   FOR INSERT USING ( false ); -- rejet direct
-- -- Laisser la RPC submit_photo (SECURITY DEFINER) faire l'insert et appliquer les règles internes.

4) Table `musiques` — insert possible pour les membres identifiés par token (RPC) ; lecture publique limitée

5) Policy admin (service_role) :
-- Les requêtes signées avec la clé `service_role` peuvent contourner RLS. Ne jamais exposer cette clé côté client.

Commandes utiles pour vérifier les RPC / policies via SQL editor :

-- lister les fonctions (RPC) :
SELECT proname, pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname NOT LIKE 'pg_%';

-- lister les policies RLS :
SELECT * FROM pg_policies WHERE schemaname = 'public';

## Conseils d'implémentation

- RPC sensibles : marquer SECURITY DEFINER et vérifier les arguments côté serveur ; retourner uniquement les colonnes strictement nécessaires.
- Pour les opérations initiées côté client sans authentification (scan QR → anon key), préférez :
  1) un RPC `get_user_by_token(p_token text)` qui valide le token et retourne un objet minimal (famille_id, nom, short_lived_session),
  2) puis créer une session front-side (localStorage) contenant le minimum d'information.
- Documentez dans ce fichier toute création/rotation de token et tout changement de policy.

## Où vérifier/mettre à jour
- Supabase Studio > SQL Editor : lister les fonctions / policies.
- Supabase Studio > Table Editor : vérifier les colonnes et contraintes.
- Après tout changement, mettez à jour ce fichier et prévenez l'équipe.

---

Parles-moi toujours en français.
``` Connexion à la db par le mcp supabase.
