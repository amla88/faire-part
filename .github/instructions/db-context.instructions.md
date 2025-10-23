Connexion à la db par le mcp supabase.
Quand une modification de la base de données est effectuée, il est important de mettre à jour ce document pour refléter la structure actuelle de la base de données.

## Tables

- public.avatar_asset_choices
- public.avatar_assets
- public.avatars
- public.familles
- public.musiques
- public.personnes
- public.profiles


---

### public.avatar_asset_choices

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 3 | avatar_id | bigint | NO |  |
| 4 | category | USER-DEFINED | NO |  |
| 5 | asset_id | bigint | NO |  |

---

### public.avatar_assets

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 3 | updated_at | timestamp with time zone | NO | now() |
| 4 | category | USER-DEFINED | NO |  |
| 5 | label | text | NO | ''::text |
| 6 | relative_path | text | NO |  |
| 7 | order_index | integer | NO | 0 |
| 8 | depth | smallint | NO | 50 |
| 9 | width | integer | YES |  |
| 10 | height | integer | YES |  |
| 11 | enabled | boolean | NO | true |

---

### public.avatars

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 3 | personne_id | bigint | NO |  |
| 4 | couleur_peau | smallint | YES |  |
| 5 | couleur_cheveu | smallint | YES |  |
| 6 | forme_cheveu | smallint | YES |  |
| 7 | accessoire | smallint | YES |  |
| 8 | pilosite | smallint | YES |  |
| 9 | chapeau | smallint | YES |  |

---

### public.familles

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 4 | personne_principale | bigint | YES |  |
| 5 | connexion | timestamp with time zone | YES |  |
| 6 | auth_uuid | uuid | YES |  |
| 7 | login_token | text | YES |  |
| 8 | is_admin | boolean | YES | false |
| 9 | created_by | uuid | YES |  |
| 10 | rue | text | YES |  |
| 11 | numero | text | YES |  |
| 12 | boite | text | YES |  |
| 13 | cp | text | YES |  |
| 14 | ville | text | YES |  |
| 15 | pays | text | YES |  |

---

### public.musiques

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 3 | titre | text | NO |  |
| 4 | auteur | text | NO |  |
| 5 | lien | text | NO |  |
| 6 | commentaire | text | NO |  |
| 7 | personne_id | bigint | NO |  |

---

### public.personnes

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | bigint | NO |  |
| 2 | created_at | timestamp with time zone | NO | now() |
| 3 | nom | text | NO |  |
| 4 | prenom | text | NO |  |
| 5 | present_reception | boolean | NO | false |
| 6 | famille_id | bigint | NO |  |
| 7 | email | text | YES |  |
| 8 | present_repas | boolean | YES | false |
| 9 | present_soiree | boolean | YES | false |
| 10 | invite_pour | USER-DEFINED | NO | 'soirée'::invite_pour |

---

### public.profiles

| # | column | type | nullable | default |
| - | ------ | ---- | -------- | ------- |
| 1 | id | uuid | NO |  |
| 2 | role | text | YES | 'invite'::text |
