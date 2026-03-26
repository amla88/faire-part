# upload-photo (Supabase Edge Function)

Objectif: proxy d’upload entre le client Angular et IONOS (SFTP) pour stocker les photos des invités.

Statut: implémentation SFTP (pour lecture via URL publique sous `assets-mariage/`).

## Deux approches possibles

1) Simple (recommandée pour démarrer):
   - Utiliser Supabase Storage (bucket `photos`) côté client.
   - Après upload, appeler la RPC `submit_photo(p_famille_id, p_file_path)` pour créer l’entrée DB.
   - Cette approche est déjà implémentée dans l’app Angular via `PhotoService`.

2) Avancée (IONOS SFTP):
   - Le client envoie `multipart/form-data` à cette edge function avec l’en-tête `x-app-token` (token invité).
   - La fonction valide le token via une RPC (ex: `get_famille_by_token`) puis signe une requête PUT vers l’endpoint S3‑compatible d’OCI et y stream le fichier.
   - La fonction upload le fichier via SFTP (dans `public/assets-mariage/...`) puis renvoie `{ path, publicUrl? }`.

## Variables d’environnement requises (SFTP)

A définir dans Supabase (Dashboard → Edge Functions → “Secrets”):

- SFTP_SERVER: ex. `access-5020006231.webspace-host.com`
- SFTP_PORT: ex. `22` (optionnel, défaut `22`)
- SFTP_USERNAME: ex. `su515704`
- SFTP_PASSWORD: mot de passe SFTP
- SFTP_REMOTE_ASSETS_DIR: dossier distant (dans le home SFTP). Par défaut `public/assets-mariage`
- SFTP_WEB_ASSETS_PATH: chemin web correspondant. Par défaut `assets-mariage`
- PUBLIC_BASE_URL: URL publique de ton site (ex. `https://amourythibaud.be`)

## Points à implémenter

- Chemin d’objet: `famille-<id>/<timestamp>-<rand>.<ext>`
- Sécurité: valider `x-app-token` via une RPC SECURITY DEFINER; limiter la taille/mime.
- Retour: JSON `{ path, publicUrl? }` et éventuellement appel interne à `submit_photo`.

## Alternatives

- Générer des PAR (Pre-Authenticated Requests) côté serveur, puis faire un `PUT` direct depuis le client vers OCI.
- Rester sur Supabase Storage pour simplifier le déploiement, et migrer vers OCI plus tard si nécessaire.
