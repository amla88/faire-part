# upload-photo (Supabase Edge Function)

Objectif: proxy d’upload entre le client Angular et Oracle Object Storage (OCI) pour stocker les photos des invités.

Statut: placeholder. Le code renvoie 501 tant que les secrets OCI ne sont pas configurés et que la signature SigV4 n’est pas implémentée.

## Deux approches possibles

1) Simple (recommandée pour démarrer):
   - Utiliser Supabase Storage (bucket `photos`) côté client.
   - Après upload, appeler la RPC `submit_photo(p_famille_id, p_file_path)` pour créer l’entrée DB.
   - Cette approche est déjà implémentée dans l’app Angular via `PhotoService`.

2) Avancée (OCI):
   - Le client envoie `multipart/form-data` à cette edge function avec l’en-tête `x-app-token` (token invité).
   - La fonction valide le token via une RPC (ex: `get_famille_by_token`) puis signe une requête PUT vers l’endpoint S3‑compatible d’OCI et y stream le fichier.
   - Enfin, elle appelle `submit_photo` avec le chemin OCI ou renvoie ce chemin au client qui fera l’appel RPC.

## Variables d’environnement requises (OCI)

A définir dans Supabase (Dashboard → Edge Functions → “Secrets”):

- OCI_REGION: ex. `eu-paris-1`
- OCI_NAMESPACE: votre namespace Object Storage
- OCI_BUCKET: ex. `assets-mariage`
- OCI_S3_ACCESS_KEY: clé d’accès S3‑compatible
- OCI_S3_SECRET_KEY: secret S3‑compatible
- OPTIONAL_PUBLIC_BASE_URL: URL publique pour lire les objets si vous servez en public

## Points à implémenter

- Signature AWS SigV4 pour endpoints S3 compatibles (header Authorization + x-amz-date, etc.).
- Chemin d’objet: `famille-<id>/<timestamp>-<rand>.<ext>`
- Sécurité: valider `x-app-token` via une RPC SECURITY DEFINER; limiter la taille/mime.
- Retour: JSON `{ path, publicUrl? }` et éventuellement appel interne à `submit_photo`.

## Alternatives

- Générer des PAR (Pre-Authenticated Requests) côté serveur, puis faire un `PUT` direct depuis le client vers OCI.
- Rester sur Supabase Storage pour simplifier le déploiement, et migrer vers OCI plus tard si nécessaire.
