# Next steps (checklist) — pour le prompt Cursor

## A) Photos sur IONOS (priorité technique)
1. Clarifier avec toi:
   - IONOS: as-tu un storage “Object Storage” S3-compatible ou uniquement SFTP/FTP?
   - Les URLs doivent-elles être publiques ou privées (URLs signées)?
2. Cibler les fichiers à modifier:
   - `supabase/functions/upload-photo/index.ts`
   - `supabase/functions/list-photos/index.ts`
   - `src/app/services/photo.service.ts` (uniquement si besoin de headers/contrat de réponse)
3. Conserver:
   - contrat auth via `x-app-token` et RPC `get_famille_by_token`
   - convention de clés `famille-<id>/...`

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

