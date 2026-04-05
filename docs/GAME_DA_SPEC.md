# Spécification DA pixel — jeu « Chronique du Domaine »

Document de référence pour garder une cohérence visuelle (V1). À mettre à jour si tu changes de vue ou de taille de tile.

## Vue et perspective

- **Vue retenue pour la V1 : top-down** (caméra du dessus, déplacement sur le plan X/Y comme les actes cour / cuisine / hub).
- Les décors « latéraux » (façades, personnages vus de profil) pourront arriver en V2 si tu passes en **side-view** ; ne pas mélanger les deux dans une même scène sans retravail.

## Résolution Phaser

- Surface logique : **960×540** (`pixelArt: true`, upscale net).
- **Tiles « monde » (design)** : **32×32 px** par tuile source.
- **Affichage** : facteur **×2** recommandé (`setScale(2)` ou `setTileScale(2)`) pour une tuile écran ~64 px, lisible sur mobile.

## Palette (hex) — verrouillage produit

| Rôle        | Hex       | Usage                          |
|------------|-----------|--------------------------------|
| Crème fond | `#faf6f1` | Fond Phaser / ciel intérieur   |
| Crème sol  | `#e8ddd0` | Pavés / plancher clair         |
| Encre      | `#48494c` | Contours, texte                |
| Or         | `#c9a55c` | Filets, accents Bridgerton     |
| Sauge      | `#abbca6` | Secondaire, UI dialogue        |
| Brique     | `#9c4c4c` | Murs cour, toits               |
| Pierre     | `#6b6560` | Pierre froide                  |
| Bois       | `#5c4033` | Poutres, carrosse              |
| Peau       | `#e8c4a8` | Silhouettes (teinte de base)   |
| Manteau PNJ| `#8FAAC7` | Majordome (réf. acte 1)        |

Toute image IA ou tileset importé doit être **recolorisé** vers cette palette dans Piskel (ou équivalent) avant intégration.

## Moodboard (pistes de référence)

À collecter localement (dossier ou Pinterest privé) : **5 à 10 images** mélangeant :

1. Références **Bridgerton** : intérieurs régence, crème et or, lumière douce.
2. **Pixel art** RPG 16-bit : lisibilité silhouette, peu de détails par tile.
3. **Rural belge** : brique rouge, pavés, grange, verger.

Mots-clés utiles pour recherche / prompts : `regency interior`, `belgian farmhouse brick`, `pixel art top down RPG tileset`, `cream gold sage palette`.

## Fichiers générés (placeholders)

Les PNG sous `src/assets/game/` livrés avec le repo sont des **placeholders** générés par `tools/generate-game-placeholders.js` (remplaçables par ton pipeline IA → Piskel).

## Voir aussi

- [GAME_PIXEL_TOOLCHAIN.md](GAME_PIXEL_TOOLCHAIN.md) — outils et ordre de travail.
- [JEU_V1_ROADMAP.md](JEU_V1_ROADMAP.md) — stratégie assets et budget.
