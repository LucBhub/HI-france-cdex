# Import architecture Ignition France

Date: 2026-06-01

Ce lot ajoute un importeur prudent pour preparer la reprise de l'architecture Ignition France, sans connexion a `BDD_Ignition` et sans inventer de donnees terrain.

## Source

Export inspecte:

```text
C:\Users\l.boillat\Downloads\Hyperviseur_V3_2026-06-01_1028.zip
```

Le ZIP contient les vues Perspective, scripts et named queries Ignition. Il ne contient pas les lignes SQL de `dev_ignition.Sites`, `Cellules`, `Onduleurs`, etc.

La metadata extraite est versionnee ici:

```text
backend/data/ignition-architecture-export.json
```

Elle capture:

- la named query canonique `Architecture/Create_Tag`;
- les colonnes attendues;
- les principales named queries architecture;
- les tables sources `dev_ignition`;
- les regles de mapping vers nos tables `architecture_*`;
- le fait explicite que `containsDataRows=false`.

## Mapping v1

La query canonique `Architecture/Create_Tag` produit des lignes avec:

```text
Site, type_poste, Agregateur, Equipement, Ordre_Cellule,
Nom_Onduleur, Num_Onduleur, Adresse_Ip, Client, Hyperviseur
```

Mapping cible:

- `Site` -> `architecture_sites.site_code` et `name`.
- champs site optionnels `Lattitude`, `Longitude`, `Adresse`, `CE` -> `architecture_sites`.
- champs site optionnels `Puissance`, `id_Centrale` -> `architecture_sites.raw_source`.
- `type_poste` -> `architecture_postes.poste_code` et `type_poste`.
- ligne cellule -> `architecture_cellules` si `Ordre_Cellule` existe ou si `Equipement` ressemble a une cellule.
- ligne onduleur -> `architecture_onduleurs` si `Nom_Onduleur` ou `Num_Onduleur` existe, ou si `Equipement` contient `Onduleur`.
- autre ligne equipement -> `architecture_equipements`.

L'export a une ambiguite dans la branche `Onduleur` de `Create_Tag` avec un alias `Equipement` duplique. L'importeur ne s'appuie donc pas uniquement sur `Equipement` pour reconnaitre les onduleurs.

## Comportement actuel

Au demarrage sandbox, le backend:

1. synchronise le catalogue commandes;
2. backfill seulement `architecture_sites` depuis `plants`;
3. enregistre une ligne `architecture_imports` avec `source=ignition_export_architecture_metadata` et `status=metadata_only`.

Aucun poste, cellule, equipement ou onduleur n'est cree depuis le ZIP tant que les lignes `Create_Tag` reelles ne sont pas fournies.

Route de lecture:

```http
GET /api/architecture/imports
```

Elle permet de verifier que l'import metadata est bien trace.

## Import futur de rows Create_Tag

Quand un export de resultats `Architecture/Create_Tag` sera disponible en JSON, CSV ou TSV, commencer par une preview:

```powershell
cd backend
npm run architecture:import -- C:\path\to\create-tag-rows.json
```

La preview ne modifie pas la base et retourne les compteurs sites/postes/cellules/equipements/onduleurs plus quelques samples. Pour ecrire en base, il faut demander explicitement l'application:

```powershell
cd backend
npm run architecture:import -- --apply C:\path\to\create-tag-rows.json
```

CSV et TSV sont aussi acceptes:

```powershell
cd backend
npm run architecture:import -- C:\path\to\create-tag-rows.csv
npm run architecture:import -- --apply C:\path\to\create-tag-rows.tsv
```

Formats acceptes:

```json
[
  {
    "Site": "Plan Auron",
    "type_poste": "PTR 1",
    "Equipement": "Cellule Arrivee",
    "Ordre_Cellule": 1,
    "Client": "MQTT",
    "Hyperviseur": true
  }
]
```

ou:

```json
{
  "rows": []
}
```

Sans argument ou avec `--metadata-only`, la commande enregistre seulement la metadata:

```powershell
cd backend
npm run architecture:import
npm run architecture:import -- --metadata-only
```

## Garde-fous

- Pas de connexion a `BDD_Ignition` dans ce lot.
- Pas de commande live.
- Pas de bridge MQTT production.
- Tous les imports sont journalises dans `architecture_imports`.
- Les donnees issues de l'export restent marquees `validationStatus=inferred`.
- Les fichiers de rows sont en preview par defaut; `--apply` est obligatoire pour ecrire en base.

## Tests

Depuis `backend/`:

```powershell
npm test -- --runInBand __tests__/lib/ignition-architecture-import.test.js
```

La couverture verifie:

- lecture de la metadata versionnee;
- classification cellule/equipement/onduleur;
- parsing des lignes `Create_Tag`;
- parsing JSON/CSV/TSV et preview dry-run;
- import idempotent des entites;
- import metadata-only sans creation d'entites enfants.
