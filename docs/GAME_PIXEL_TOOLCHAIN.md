# Chaîne d’outils — pixel art & intégration Phaser

Guide minimal pour travailler **sans sur-dépenses** ; un **abonnement IA d’un mois** reste optionnel pour les sessions de génération groupées.

## 1. Outils gratuits (recommandés)

| Rôle | Outil | Notes |
|------|--------|--------|
| Pixel / retouche | [Piskel](https://www.piskelapp.com/) (web) ou [LibreSprite](https://libresprite.github.io/) | Posteriser sur la palette de [GAME_DA_SPEC.md](GAME_DA_SPEC.md) |
| Cartes & tiles | [Tiled](https://www.mapeditor.org/) | Export JSON compatible Phaser (phase ultérieure) |
| Spritesheet + JSON | [Free Texture Packer](https://free-tex-packer.com/app/) | Atlas pour `load.atlas` |
| Palettes | [Lospec](https://lospec.com/palette-list) | Créer une palette custom alignée sur le doc DA |
| Bases CC0 | [Kenney](https://kenney.nl/), [OpenGameArt](https://opengameart.org/) | Props génériques à recolorer |

## 2. IA générative (option payante courte)

- Choisir **un** service (ex. Midjourney, Leonardo, Ideogram) pour **une** période dédiée.
- Générer en **lot** le même jour avec le **même gabarit de prompt** (voir [JEU_V1_ROADMAP.md](JEU_V1_ROADMAP.md) §3 prompts).
- Toujours **repasser** les images en pixel propre (Piskel) : l’IA ne remplace pas la cohérence palette / tiles.

## 3. Ordre de travail conseillé

1. Lire [GAME_DA_SPEC.md](GAME_DA_SPEC.md) (vue, tile 32, palette).
2. Tileset minimal tileable → test dans Tiled (jointures).
3. Sprite joueur top-down → une animation plus tard si besoin.
4. Portraits PNJ carrés **48×48** ou **64×64** (même cadrage).
5. Remplacer les placeholders dans `src/assets/game/` en gardant **les mêmes noms de fichiers** ou mettre à jour `src/game/scenes/PreloadScene.ts`.

## 4. Intégration dans ce repo

- Assets servis par Angular : chemins **`assets/game/...`** depuis le navigateur.
- Préchargement : [src/game/scenes/PreloadScene.ts](../src/game/scenes/PreloadScene.ts).
- Régénérer les placeholders : `npm run game:placeholders`.
