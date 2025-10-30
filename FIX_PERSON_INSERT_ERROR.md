# Correction de l'erreur d'insertion des personnes

## Problème résolu

### ❌ Erreur originale:
```json
{
    "code": "23502",
    "details": null,
    "hint": null,
    "message": "null value in column \"id\" of relation \"personnes\" violates not-null constraint"
}
```

### ✅ Cause identifiée:
- Lors de l'ajout d'une nouvelle personne, l'`id` était `undefined/null`
- Supabase tentait d'insérer `null` dans la colonne `id` (non-null constraint)
- La logique d'upsert ne distinguait pas les nouvelles personnes des existantes

## Solution implémentée

### 1. **Exclusion conditionnelle de l'ID**
```typescript
// N'inclure l'ID que s'il existe (personne existante)
if (id) {
  personData.id = id;
}
```

### 2. **Séparation des opérations**
```typescript
// Séparer les nouvelles personnes des personnes existantes
const existingPersons = toUpsert.filter(p => p.id);
const newPersons = toUpsert.filter(p => !p.id);

// Mise à jour des existantes
if (existingPersons.length > 0) {
  await client.from('personnes').upsert(existingPersons, { onConflict: 'id' });
}

// Insertion des nouvelles
if (newPersons.length > 0) {
  await client.from('personnes').insert(newPersons);
}
```

## Test de la correction

### Scénario à tester:
1. **Ouvrir une famille existante** via `/admin/famille/{id}`
2. **Ajouter une nouvelle personne** (bouton +)
3. **Remplir les informations** de la nouvelle personne
4. **Cliquer "Sauvegarder tout"**
5. **Vérifier** qu'aucune erreur n'apparaît
6. **Confirmer** que la nouvelle personne est bien créée

### Comportements attendus:
- ✅ Pas d'erreur 23502
- ✅ Nouvelle personne créée en DB
- ✅ Personnes existantes mises à jour
- ✅ Message de succès affiché
- ✅ Données rechargées correctement

### Autres tests:
- **Modification d'une personne existante** (doit utiliser upsert)
- **Suppression puis ajout** (doit fonctionner)
- **Mixte** : modifier une existante + ajouter une nouvelle

## Fichiers modifiés:
- `admin-famille-detail.component.ts` → méthode `savePersons()`