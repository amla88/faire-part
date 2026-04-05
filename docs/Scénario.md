# 📜 Scénario : La Chronique du Domaine
**Thème :** Bridgerton (Régence) x Pixel Art x Ruralité Belge
**Framework :** Phaser.js
**Backend :** Supabase (Données) & IONOS (Images)

---

## 🎭 ACTE 0 : L'Habillage dans le Carrosse (Sélection)
* **Lieu :** Intérieur d'un carrosse de luxe. Banquettes de velours, dorures pixelisées. On voit la campagne belge défiler par les fenêtres.
* **Implémentation actuelle (V1) :** cabine stylisée en pixel ; **quatre silhouettes** au banc (pas de miroir animé pour l’instant). Le joueur **sélectionne** une silhouette (souris ou **flèches / ZQSD**, puis validation), ce qui fixe l’archétype pour la partie. Un miroir de cour pourra enrichir la scène dans une itération ultérieure si les assets le permettent.
* **Les Personnages :** * *La Lady* (Robe empire)
    * *Le Gentleman* (Redingote & Haut-de-forme)
    * *La Reine de la Nuit* (Dragqueen monumentale)
    * *Le Duc de la Scène* (Dragking en velours)
* **Dialogue d'accueil :** > "La route est encore longue jusqu'à la ferme. Ajustez votre tenue, cher invité, car le monde entier aura les yeux rivés sur vous à notre arrivée."

---

## 🌳 ACTE 1 : La Cour d'Honneur (Le Registre)
* **Lieu :** Cour pavée, murs de briques rouges, glycines en fleurs. Une grille imposante bloque l'accès.
* **PNJ :** **Monsieur de La Plume** (Le Majordome au monocle).
* **Tâche OBLIGATOIRE :** Présence (Réception / Repas / Soirée).
* **Dialogue (Nouveau) :** > "Votre nom, s'il vous plaît ? Le protocole du banquet est une science exacte. Je dois savoir si vous honorerez notre table pour le souper ou si vous nous rejoindrez pour les festivités nocturnes."
* **Dialogue (Si déjà rempli via Angular) :** > "Ah ! Votre nom brille déjà dans nos colonnes comme une promesse de fête. Entrez, la cour trépigne de vous voir !"

---

## 🧺 ACTE 2 : L'Office des Saveurs (Santé & Bien-être)
* **Lieu :** Près des cuisines, étals de légumes frais et miches de pain fumantes.
* **PNJ :** **L'Intendant des Cuisines** (Toque immense et louche en argent).
* **Tâche :** Liste des allergènes.
* **Dialogue :** > "Doucement, voyageur ! Ma cuisine est un temple de délices, mais je refuserais de vous empoisonner par mégarde. Y a-t-il des ingrédients — noix, gluten ou autres maléfices — que votre estomac ne saurait tolérer ? Confiez-moi vos interdits."

---

## 🕯️ ACTE 3 : La Grande Grange (La Galerie des Reflets)
* **Lieu :** Grange rustique, poutres massives, bougies flottantes.
* **PNJ :** **Madame Chromatique** (Robe en rubans, pinceau magique).
* **Tâche VIVEMENT RECOMMANDÉE :** Création de l'Avatar (Lien Dicebear).
* **Dialogue :** > "Quelle silhouette charmante, mais il lui manque ce 'je-ne-sais-quoi' numérique ! Approchez de mon miroir. Votre portrait doit être aussi mémorable qu'une rumeur dans la Gazette de ce matin."

---

## 🍏 ACTE 4 : Le Verger des Confidences (Mémoire Visuelle)
* **Lieu :** Verger de pommiers, rivière en 8-bit, bancs romantiques.
* **PNJ :** **Le Vicomte des Murmures** (Caché sous un arbre avec un carnet).
* **Tâches OPTIONNELLES :** Envoi de photo & Anecdote/Souvenir.
* **Dialogue :** > "Psst ! On dit que vous connaissez les futurs mariés depuis fort longtemps... Confiez-moi un souvenir croustillant pour mon recueil. Et si vous possédez une image de leur idylle, glissez-la dans ce coffret entre deux pommiers."

---

## 🖋️ ACTE 5 : La Gloriette aux Souhaits (Boîte à Idées)
* **Lieu :** Belvédère en bois ciselé au milieu des roses.
* **PNJ :** **La Baronne de l'Inspiration** (Chapeau à plumes de paon).
* **Tâche OPTIONNELLE :** Boîte à idées pour le mariage.
* **Dialogue :** > "Oh, vous avez l'œil pétillant d'ingéniosité ! Le mariage est une œuvre d'art en constante évolution. Avez-vous une suggestion audacieuse pour rendre cette journée encore plus exquise ? Écrivez-le sur ce billet, je le remettrai aux mariés."

---

## 🎻 ACTE 6 : L'Écurie Musicale (Le Tempo du Bal)
* **Lieu :** Écurie décorée de lustres, instruments de musique automates.
* **PNJ :** **Le Maestro Polyphonique** (Perruque poudrée et lunettes de geek).
* **Tâche OPTIONNELLE :** Playlist (1 à 3 chansons).
* **Dialogue :** > "L'harmonie de la soirée est entre vos mains ! Je cherche l'accord parfait qui fera vibrer les cœurs au-delà des collines. Quelles mélodies devrais-je commander à mon quatuor pour vous faire danser ?"

---

## 📜 ACTE 7 : Le Final (La Gazette de Lady Whistledown)
* **L'Événement :** Le joueur se place au centre du verger. Une gazette tombe du ciel.
* **Texte de la Gazette :** > "Très chers lecteurs, l'attente touche à sa fin. Les cuisines sont alertées, les musiciens accordés et les cœurs synchronisés. Tout est désormais prêt pour l'union la plus attendue de l'année. Le destin est en marche..."
* **Écran de fin :** * Compte à rebours dynamique (Jours/Heures/Minutes).
    * Remerciements personnalisés basés sur les données Supabase.

---

## Progression technique (alignée sur le code)

Les actes **1 à 3** sont **linéaires** (RSVP → allergènes → avatar). Après l’acte 3, le **hub** et la **carte rapide** débloquent les actes **4 à 6** (parcours libre entre ces lieux).

**Pour déclencher automatiquement l’acte 7 (Gazette)** une fois les étapes clés validées, l’application vérifie en parallèle :

| Condition | Rôle |
|-----------|------|
| RSVP enregistré (acte 1) | Obligatoire |
| Allergènes / remarques (acte 2) | Obligatoire |
| Avatar enregistré (acte 3) | Obligatoire |
| **Au moins une** anecdote **ou** **au moins une** photo (acte 4) | Requis pour la fin automatique |
| Au moins une idée en boîte à idées (acte 5) | Requis pour la fin automatique |
| Au moins une musique proposée (acte 6) | Requis pour la fin automatique |

Les actes 4–6 restent **narrativement** des confidences / suggestions / musiques « à la carte », mais **au moins une contribution dans chaque colonne** (verger, gloriette, écurie) est attendue pour considérer le parcours **complet** et afficher la Gazette sans rester bloqué. Pour ajuster cette règle (par ex. tout optionnel sauf RSVP), modifier la logique `allStepsDone()` dans `src/app/pages/jeu/jeu.component.ts`.