# Next steps (checklist) — pour le prompt Cursor

## A) Photos sur IONOS (priorité technique)
1. Déjà fait (implémenté):
   - API PHP IONOS sous `public/api/`:
     - `POST /api/photos-upload.php` (upload + resize/convert + rename)
     - `POST /api/photos-list.php` (listing)
     - `POST /api/photos-delete.php` (suppression)
   - Stockage sous `public/assets-mariage/personne-<id>/...` (photos associées à une personne)
   - Contrat auth: `x-app-token` + RPC Supabase (`get_famille_by_token`, `get_personnes_by_famille`)
   - Conversion HEIC/HEIF côté navigateur avant upload
2. À faire ensuite:
   - (Optionnel) rate limit / anti-spam côté API
   - (Optionnel) modération admin (flag DB + UI admin)

## B) Collecte RSVP + données invités (phases produit)
1. Cartographier exactement:
   - les champs RSVP déjà stockés (payload de `record_rsvp` / `upsert_rsvp`)
2. Ajouter ensuite les champs manquants:
   - avatar (déjà ok)
   - photo (déjà ok)
   - musiques (table existe, mais UI/flow à confirmer)
   - allergènes / anecdote / idées (à créer si absent)
3. Planifier le “mode jeu Phaser”:
   - même backend / mêmes endpoints que le mode formulaire
   - UI découpée en écrans + “collecteurs” de données

## C) Qualité et changements “petit projet privé”
- Éviter les tests si non demandés.
- Prioriser des modifications minimales.
- Garder Angular Material et patterns existants.
- Ne pas modifier `/.exemple` (design inspiration uniquement).

