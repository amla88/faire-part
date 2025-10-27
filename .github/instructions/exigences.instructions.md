- Utilises toujours le mcp contexte 7 pour la documentation. Vérifies les bonnes versions de mon application avant de répondre. Va lire le fichier package.json au démarage de chaque session pour vérifier les dépendances et versions utilisées.

- Dans le dossier .exemple\modernize-free-angular-v5\main, tu trouveras un modèle à suivre pour le design. Suis l'apparence et le style de ce modèle pour mon application.

- Remplacer <i-tabler> par <ng-icon> dans mes fichiers Angular de mon projet pour les icônes Tabler lorsque tu reprend des éléments du template exemple.

- Sépares toujours, tant que ce possible , le HTML, le TypeScript et le SASS dans des fichiers regroupé dans un dossier distincts pour mes composants Angular.

- Ne fais pas de ng build ou ng serve sans que je te le demande explicitement.

- Toujours utiliser RPC pour les appels à la DB quand c'est un appel pour un utilisateur normal. Utiliser les appels directs à la DB seulement pour les tâches d'administration ou de maintenance pour un administrateur authentifié.

- Aucun tests unitaires ou e2e pour cette application.

- à chaques nouveau prompt, analyse le code et va voir sur le mcp supabase la structure des tables et les relations entre elles pour m'assurer que les suggestions de code sont correctes et cohérentes avec la base de données actuelle. Regardes aussi les edges fonctions. Utilises le mcp context 7 pour la documentation de angular.