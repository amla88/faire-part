# Faire‑part (Angular + Phaser + Supabase)

Application du faire‑part de mariage hébergée sur GitHub Pages sous `/faire-part/`.

## Démarrer en local

Prérequis: Node 18+.

1) Installer les dépendances

```bat
npm install
```

2) Lancer le serveur de dev

```bat
npm start
```

Par défaut: http://localhost:4200/faire-part/ (le `--base-href` est injecté au build, mais en dev le `<base href="/">` est utilisé).

## Build et déploiement

Générer la production (Angular 18, base‑href `/faire-part/`):

```bat
npm run build
```

Le dossier `dist/` est produit. Déployer sur GitHub Pages:

```bat
npm run deploy
```

Un `404.html` est créé automatiquement pour le fallback SPA.

## Configuration Supabase

Les clés sont lues depuis des meta tags dans `src/index.html`:

- `meta[name="supabase-url"]`
- `meta[name="supabase-anon-key"]`

En dev, vous pouvez y mettre vos valeurs projet. En prod, on peut remplacer lors du build si nécessaire.

## Environnements

- Fichiers: `src/environments/environment.ts` (dev) et `src/environments/environment.prod.ts` (prod, utilisé via fileReplacements au build).
- Priorité de lecture des clés Supabase côté front:
	1. Valeurs dans `environment.*.ts` si définies (url, anonKey)
	2. Sinon, meta tags `supabase-url` et `supabase-anon-key` dans `index.html`
- Base href:
	- Dev: `baseHref: '/'` (dans index.html)
	- Prod: `baseHref: '/faire-part/'` (documenté dans environment.prod.ts et géré par `--base-href` au build)

## Architecture rapide

- Angular à la racine: `src/`, `angular.json`, `tsconfig*.json`.
- Jeu Phaser intégré nativement: `src/app/game` + `src/app/game/phaser/*`.
- Services Supabase (RPC‑first avec fallback): `src/app/services/*`.
- Pages invité/admin (login, RSVP, musiques, photos, avatar, admin*): `src/app/pages/*`.
- Garde invité/admin: `src/app/guards/*`.
- Assets: `src/assets/`.

## Dépannage

- Avertissement CommonJS pour Phaser au build: sans impact; ignorable.
- 404 sur GitHub Pages: vérifier que le base‑href est `/faire-part/` et que `404.html` existe dans `dist/`.
- Actifs manquants en prod: s’assurer que les chemins utilisent `/faire-part/` (Angular CLI le gère via `--base-href`).

## Licence

Projet privé pour usage familial. Merci de ne pas redistribuer.
