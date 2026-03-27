# JEU V1 - Roadmap de production

Objectif: produire un mini-RPG pixel art "Bridgerton x geek" jouable en 10-15 min sur PC, tablette et mobile (paysage), avec progression lineaire actes 0-3 puis zones ouvertes.

## 1) Cadrage produit (valide)

- Plateformes: PC + tablette + mobile.
- Orientation: paysage obligatoire.
- Affichage: plein ecran recommande.
- Deplacement:
  - clavier (fleches / WASD) sur desktop,
  - joystick virtuel + bouton interaction sur tactile,
  - UI de deplacement masquable via bouton.
- Integration formulaire: Option B (mini-formulaires in-game connectes a Supabase).
- Duree cible: 10-15 minutes.
- Direction artistique: pixel art 90s, ton Bridgerton contemporain, touches geek, humour decalé.

## 2) Stack technique (recommandee)

- Moteur: Phaser 3 + TypeScript.
- Integrateur: Angular (route dediee `/jeu` + composant hote canvas).
- Level design: Tiled Map Editor (tilemaps JSON).
- Donnees: Supabase (RPC existants + quelques RPC de progression jeu).
- Images upload: API IONOS existante.
- UI jeu:
  - overlay HTML Angular pour menus globaux (pause, map rapide),
  - UI in-canvas Phaser pour dialogues / HUD minimal.

## 3) Architecture de base (a creer)

- `src/app/pages/jeu/jeu.component.ts` (hote Angular + fullscreen/orientation guards)
- `src/game/boot/` (preload assets, init services)
- `src/game/scenes/`
  - `Act0CarrosseScene.ts`
  - `Act1CourScene.ts`
  - `Act2OfficeScene.ts`
  - `Act3GrangeScene.ts`
  - `HubOpenWorldScene.ts` (deblocage actes 4-6)
  - `FinalGazetteScene.ts`
- `src/game/systems/`
  - `InputSystem.ts` (clavier + joystick tactile)
  - `DialogueSystem.ts` (portrait PNJ + texte JRPG)
  - `QuestSystem.ts` (etats de quetes / actes)
  - `TravelMapSystem.ts` (carte rapide lieux visites)
- `src/game/ui/`
  - `VirtualControls.ts`
  - `DialogueBox.ts`
  - `QuestToast.ts`
- `src/game/data/`
  - `acts.config.ts`
  - `pnj.dialogues.ts`
  - `locations.config.ts`
- `src/game/services/`
  - `GameBackendBridge.ts` (wrappers vers RPC Supabase existants)
- `src/assets/game/`
  - `tilesets/`, `maps/`, `sprites/`, `portraits/`, `ui/`, `audio/`

## 4) UX obligatoire (Definition of Done)

- Au lancement:
  - si mobile en portrait -> ecran "Tournez votre appareil en paysage".
  - panneau "comment jouer" (2 ecrans max): deplacement, interaction, bouton masquer UI.
- En jeu:
  - bouton "Masquer/Afficher controles".
  - bouton "Plein ecran" (si support navigateur).
  - dialogue style JRPG avec portrait PNJ.
- Progression:
  - actes 0-3 bloques et lineaires.
  - apres acte 3: carte rapide activee sur lieux visites.
- Sauvegarde:
  - etat local instantane (session),
  - sync serveur a chaque validation d'objectif majeur.

## 5) Plan de production par phases

## Phase A - Fondations (2-3 jours)
- [ ] Creer route Angular `/jeu` + composant hote Phaser.
- [ ] Initialiser structure `src/game/*`.
- [ ] Support input clavier + joystick tactile.
- [ ] Ecran orientation paysage + aide "comment jouer".
- [ ] Fullscreen toggle.

Livrable A: personnage qui se deplace sur une map test, desktop + mobile.

## Phase B - Systeme narratif (2 jours)
- [ ] Dialogue box JRPG (portrait + nom + texte + next).
- [ ] Interaction PNJ (zone trigger + touche interaction).
- [ ] Systeme de quetes simple (flags en memoire).
- [ ] Donnees scenario externalisees (`pnj.dialogues.ts`).

Livrable B: micro-sequence complete avec 1 PNJ, 1 quete, 1 validation.

## Phase C - Actes 0 a 3 lineaires (4-6 jours)
- [ ] Acte 0 carrosse (selection perso).
- [ ] Acte 1 registre (presence).
- [ ] Acte 2 allergenes.
- [ ] Acte 3 avatar.
- [ ] Verrouillage/ordre des actes.
- [ ] Ecriture Supabase via bridge.

Livrable C: parcours lineaire complet, donnees sauvegardees.

## Phase D - Monde ouvert + fast travel (3-4 jours)
- [ ] Hub ouvert pour actes 4-6.
- [ ] Carte rapide (lieux visites uniquement).
- [ ] Teleport stable + retour scene.
- [ ] Acte 7 final + gazette + countdown.

Livrable D: experience complete 10-15 min.

## Phase E - Polish (2-3 jours)
- [ ] Accessibilite (taille texte, contraste, vitesse texte).
- [ ] Optimisation mobile (perf + hitboxes tactiles).
- [ ] QA multi-device.
- [ ] Correctifs UX.

Livrable E: V1 preprod.

## 6) Strategy assets pixel art (cout maitrise)

Priorite: packs existants + IA uniquement pour variantes/polish.

- Base gratuite:
  - Tilesets top-down RPG libres (OpenGameArt / Kenney / itch.io free).
  - UI pixels (fenetres/dialogues) libre.
- IA image (controle des couts):
  - Usage cible: portraits PNJ et variations d'objets decoratifs.
  - Generer en lots hebdo (pas en iteration continue).
  - Budget plafond recommande: 10-25 EUR / mois.
- Cohesion visuelle:
  - palette definie des le debut (8-16 couleurs dominantes).
  - resolution cible fixe (ex: base 320x180 upscale x4).

## 7) Risques et parades

- Risque: scope trop grand.
  - Parade: verrouiller V1 a 6-7 scenes max, pas de combat.
- Risque: perf mobile.
  - Parade: atlas sprites limites, animations courtes, faible densite NPC.
- Risque: incoherence narrative.
  - Parade: script centralise par acte + relectures courtes.
- Risque: dette technique.
  - Parade: separer systems (input/dialogue/quest) des scenes.

## 8) Checklist de lancement V1

- [ ] Route `/jeu` disponible dans le menu.
- [ ] Phase A a E completee.
- [ ] Tests desktop Chrome/Edge + mobile Android/iOS.
- [ ] Temps moyen session entre 10 et 15 min.
- [ ] Donnees clefs bien poussees en base (RSVP, allergenes, avatar, musiques, idees).
- [ ] Plan de fallback si erreur reseau (retry + message RP "le majordome reprend note").

## 9) Backlog post-V1 (optionnel)

- Mini-jeux courts (rythme, puzzle social).
- Variantes de dialogues selon profil invite.
- SFX adaptatifs selon zone.
- Sauvegarde cross-device avancee.
- Cinematiques pixel (intro/outro) plus riches.

