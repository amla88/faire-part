# faire-part
faire-part — Faire‑part de mariage

## Mise à jour des dépendances (24-10-2025)

Actions réalisées :

- Mise à jour automatique des dépendances vers leurs dernières versions (majeures + mineures) via `npm-check-updates`.
- Installation des nouvelles versions (`npm install`).
- Adaptation des tests unitaires pour Angular 20+ (composants standalone) :
	- `AppComponent` déplacé des `declarations` vers `imports` dans `app.component.spec.ts`.
	- Ajustement des assertions de test pour refléter le titre et le template actuels.
- Exécution des tests unitaires (headless) — tous les tests passent.
- Build de l'application — build réussi, sortie dans `dist/faire-part`.

Remarques / suivis recommandés :

- Vérifier manuellement l'application en local (`npm start`) et parcourir les pages critiques (jeu Phaser, upload photos, page admin).
- Passer en revue les changements majeurs (ex : `@ngx-translate` v17, `@ng-matero/extensions` v20) — certaines APIs peuvent avoir changé.
- Versionner ces changements dans une branche dédiée et ouvrir une pull request pour revue avant déploiement en production.

Si vous voulez, je peux :

- Committer les changements locaux et créer une branche/PR (si vous me donnez le feu vert).
- Exécuter une vérification plus approfondie (lint, tests E2E s'il y en a, vérification Phaser).
- Mettre à jour la configuration de déploiement (`base-href`, 404 fallback) et préparer le déploiement GitHub Pages.

## Upload de photos — configuration rapide

Deux options de stockage sont supportées :

1) Supabase Storage (simple, prêt à l’emploi)
	- Créez un bucket `photos` (public ou restreint selon vos besoins).
	- Ajoutez une policy pour autoriser les utilisateurs authentifiés à uploader dans un sous-dossier par famille, par ex. `famille-<id>/*`.
	- Le front uploade directement dans `photos/` puis appelle la RPC `submit_photo` pour créer l’entrée en base.
	- Déjà implémenté côté front : page `/photos/upload`.

	Exemple de policy (à adapter) :
	- Autoriser `insert` si l’utilisateur est authentifié ET si le chemin commence par `famille-<famille_id>/` dérivé du contexte (voir RLS/claims).

2) Oracle Object Storage (OCI) via Edge Function (avancé)
	- Implémentez la signature AWS SigV4 dans `supabase/functions/upload-photo/index.ts` et configurez les secrets (voir `supabase/functions/upload-photo/README.md`).
	- Le client envoie `multipart/form-data` à l’edge function avec `x-app-token` pour associer la famille.
	- L’edge function stream le fichier vers OCI et appelle `submit_photo`.

Page front disponible :
- Route: `#/photos/upload`
- Fichiers: `src/app/pages/photos/upload/`
- Service: `src/app/services/photo.service.ts`

