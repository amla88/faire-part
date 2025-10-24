# Modernize-Angular-pro
Modernize Angular Admin Dashboard

## Mise à jour des dépendances (24-10-2025)

Actions réalisées :

- Mise à jour automatique des dépendances vers leurs dernières versions (majeures + mineures) via `npm-check-updates`.
- Installation des nouvelles versions (`npm install`).
- Adaptation des tests unitaires pour Angular 20+ (composants standalone) :
	- `AppComponent` déplacé des `declarations` vers `imports` dans `app.component.spec.ts`.
	- Ajustement des assertions de test pour refléter le titre et le template actuels.
- Exécution des tests unitaires (headless) — tous les tests passent.
- Build de l'application — build réussi, sortie dans `dist/Modernize`.

Remarques / suivis recommandés :

- Vérifier manuellement l'application en local (`npm start`) et parcourir les pages critiques (jeu Phaser, upload photos, page admin).
- Passer en revue les changements majeurs (ex : `@ngx-translate` v17, `@ng-matero/extensions` v20) — certaines APIs peuvent avoir changé.
- Versionner ces changements dans une branche dédiée et ouvrir une pull request pour revue avant déploiement en production.

Si vous voulez, je peux :

- Committer les changements locaux et créer une branche/PR (si vous me donnez le feu vert).
- Exécuter une vérification plus approfondie (lint, tests E2E s'il y en a, vérification Phaser).
- Mettre à jour la configuration de déploiement (`base-href`, 404 fallback) et préparer le déploiement GitHub Pages.

