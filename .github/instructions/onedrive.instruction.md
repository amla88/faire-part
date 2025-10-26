# Plan d'implémentation : Angular + Supabase Edge Function → OneDrive

## Objectif
Application Angular hébergée sur GitHub Pages, permettant à des utilisateurs anonymes d’uploader et de visualiser des fichiers (photos, avatars, galerie), en utilisant :

- **Supabase Edge Function** comme backend sécurisé
- **OneDrive personnel** pour stocker les fichiers
- **Angular** pour le front-end
- **Code d’accès simple** pour authentifier les utilisateurs anonymes (8 caractères)

L’IA pourra rechercher et choisir les meilleures solutions pour la configuration Angular, Supabase et OneDrive.

---

## Étapes de mise en œuvre

### 1. Configuration OneDrive
- Utiliser un compte un compte OneDrive existant
- Créer une **app Microsoft** dans Azure Portal pour accéder à OneDrive via **Microsoft Graph API**
- Noter les informations clés :
  - Client ID
  - Tenant ID
  - Client Secret
- Définir les permissions requises :
  - `Files.ReadWrite` pour lire/écrire sur OneDrive
  - `User.Read` pour récupérer des infos utilisateur si nécessaire
- Tester l’obtention d’un **access token** via OAuth2
- Vérifier la possibilité de stocker des fichiers

### 2. Configuration Supabase
- Vérifier les quotas gratuits et limites de Edge Functions
- Créer une **Edge Function** qui servira de proxy pour OneDrive
  - Stocker l’access token OneDrive dans les **variables d’environnement**
  - Définir les routes HTTP nécessaires :
    - `/upload-photo`
    - `/list-gallery`
    - `/upload-avatar`
- Tester la fonction via des requêtes HTTP directes pour vérifier l’upload sur OneDrive
- Expliquer comment en ajouter

### 3. Configuration Angular
- Créer un service Angular pour communiquer avec la Edge Function
  - Méthodes :
    - upload de fichiers
    - récupération de liste de fichiers
    - affichage des fichiers (galerie)
- Restreindre l’upload par utilisateur.

### 4. Flux d’utilisation
1. L’utilisateur s'authentifie avec un **code d’accès**.
2. Angular envoie le fichier et le code à la **Edge Function**.
3. La Edge Function valide le code et upload le fichier sur OneDrive via Microsoft Graph.
4. Angular récupère la liste des fichiers pour afficher la galerie.

### 5. Points à documenter pour l’IA
- Documentation Angular par mcp conext7 pour uploader et afficher des fichiers
- Documentation Supabase Edge Functions et variables d’environnement par mcp conext7 
- Documentation Microsoft Graph API pour OneDrive :
  - Upload de fichiers
  - Listing de fichiers
  - Obtenir les liens de téléchargement
- Bonnes pratiques sécurité pour ne **jamais exposer le token OneDrive dans le front-end**
- Gestion des fichiers jusqu’à 100 mo si nécessaire

### 6. Objectifs de recherche pour l’IA
- Meilleure façon de gérer l’upload en Angular vers une Edge Function
- Gestion des erreurs et des fichiers volumineux
- Bonnes pratiques pour afficher une galerie dynamique à partir des fichiers OneDrive
- Sécuriser un accès via code d’accès simple pour des utilisateurs anonymes

---

## Résultat attendu
- Une application Angular hébergée sur GitHub Pages
- Upload sécurisé vers OneDrive via Supabase Edge Function
- Galerie dynamique d’images stockées sur OneDrive
- Système simple d’authentification par code pour utilisateurs anonymes
- Documentation complète pour reproduire et maintenir le projet