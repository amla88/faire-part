# Configuration Supabase - Administration

## Résumé des modifications
✅ **Code simplifié** : Tous les composants admin utilisent maintenant uniquement des accès directs aux tables
✅ **Suppression des RPC** : Plus de fonctions RPC complexes pour l'administration
✅ **Code nettoyé** : Suppression des méthodes de fallback et logique RPC
✅ **Logique nom famille** : Le nom de la famille est dérivé de la personne principale

## Structure de données corrigée

### Table `familles` - PAS de colonne `nom`
La table `familles` ne contient **PAS** de colonne `nom`. Le nom de la famille est dérivé de la personne principale :
- Si `personne_principale` est définie → `Famille [prenom] [nom]`  
- Sinon, utiliser la première personne → `Famille [prenom] [nom]`
- En dernier recours → `Famille #[id]`

### Colonnes existantes dans `familles` :
- `id`, `rue`, `numero`, `boite`, `cp`, `ville`, `pays`, `personne_principale`
- `created_at`, `updated_at`

## Erreurs communes et solutions

### ❌ Erreur: `permission denied for table users`
**Cause**: La table `profiles` n'existe pas ou a des politiques RLS incorrectes.

**Solution**: Exécuter le script `supabase/migrations/create_profiles_table.sql`

### ❌ Erreur: `Could not find the 'nom' column`
**Cause**: Tentative d'accès à une colonne `nom` inexistante dans `familles`.

**Solution**: ✅ Corrigé automatiquement - le nom est maintenant dérivé de la personne principale

### ❌ Erreur: `new row violates row-level security policy`
**Cause**: RLS activé sur les tables familles/personnes.

**Solution**: Voir configuration ci-dessous

## Configuration Supabase nécessaire

### 1. Table `profiles` (OBLIGATOIRE)
```sql
-- Exécuter le fichier complet:
-- supabase/migrations/create_profiles_table.sql
```

### 2. Désactiver RLS sur les tables de données
```sql
-- Désactiver RLS sur la table familles
ALTER TABLE familles DISABLE ROW LEVEL SECURITY;

-- Désactiver RLS sur la table personnes  
ALTER TABLE personnes DISABLE ROW LEVEL SECURITY;
```

### Alternative : Politiques RLS permissives pour les admins

Si vous préférez garder RLS activé :

```sql
-- Politique pour les administrateurs sur familles
CREATE POLICY "Admins can do everything on familles" ON familles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Politique pour les administrateurs sur personnes
CREATE POLICY "Admins can do everything on personnes" ON personnes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

### 3. Créer un utilisateur admin

1. **Créer un compte** via l'interface Supabase Auth ou votre app
2. **Donner le rôle admin** :
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'votre-email-admin@example.com'
);
```

## Vérification

Une fois la configuration appliquée, testez :

1. **Connexion admin** via `/admin-login`
2. **Création d'une famille** via `/admin/famille` (le nom sera automatique)
3. **Modification d'une famille** via `/admin/famille/{id}` (nom affiché dynamiquement)
4. **Liste des familles** affiche les noms corrects basés sur la personne principale

## Structure finale du code

- **Famille** : Pas de champ nom dans le formulaire, nom calculé dynamiquement
- **Affichage** : `familyDisplayName()` ou `getFamilyDisplayName()` 
- **Logique** : Personne principale → Première personne → Famille #ID
- **CRUD** : Accès direct aux tables sans RPC