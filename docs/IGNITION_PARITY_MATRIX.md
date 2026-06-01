# Matrice de parite Ignition France

Date: 2026-06-01

Cette matrice transforme l'audit Ignition France en backlog pilotable. Elle ne remplace pas la validation terrain: elle sert a savoir ce qui est deja couvert par le repo, ce qui est partiel, ce qui manque, et ce qui doit rester bloque tant que le live n'est pas valide.

Fichier machine-readable associe: `docs/IGNITION_PARITY_MATRIX.json`.

## Legende

| Statut | Sens |
| --- | --- |
| `done` | Couvert dans le repo et verifiable localement. |
| `partial` | Base presente, mais parite Ignition incomplete ou lecture seule. |
| `missing` | Fonctionnalite non implementee dans le repo. |
| `blocked` | Implementation volontairement bloquee par securite, acces ou validation terrain. |

## Synthese par domaine

| Domaine | Priorite | Statut | Etat repo actuel | Prochain jalon |
| --- | --- | --- | --- | --- |
| Stack sandbox Docker | P0 | done | `.env.example`, Compose, Postgres, backend, frontend, MQTT broker et simulateur sont reproductibles localement. | Garder CI verte et documenter les ports de test. |
| Securite commandes live | P0 | done | `COMMAND_LIVE_ENABLED=false` par defaut et kill switch code-level. Les routes commandes restent dry-run. | Aucune activation live avant matrice terrain validee. |
| Command service dry-run | P0 | done | `POST /api/commands`, journal `command_runs`, MQTT sandbox, ACK simulateur et `audit_logs`. | Ajouter validations metier par type de cible. |
| Catalogue commandes Ignition | P0 | partial | 15 cles versionnees, toutes `live_enabled=false` et `validation_status=inferred`. | Valider topic/tag/payload/duree/risque avec exploitation. |
| Observabilite commandes | P0 | done | Historique runs, timeline MQTT, ACK rattaches aux runs, Command Center UI. | Ajouter filtres/export si besoin exploitation. |
| Donnees France sandbox | P0 | done | Loader local ignore Git; test stack charge 108 sites, 220 postes, 651 cellules, 930 equipements, 1198 onduleurs. | Automatiser seulement avec export sanitise ou acces read-only. |
| Modele architecture France | P1 | partial | Tables sites/postes/cellules/equipements/onduleurs, import metadata, import rows, site-only import. | Consolider mapping complet et contraintes metier. |
| Dashboard architecture | P1 | partial | Page `/architecture` read-only avec resume, filtres et arbre site. | Ajouter vue detail site type synoptique read-only. |
| Carte `Test_Maps` | P1 | partial | Le repo a une carte/dashboard centrales, mais pas encore la parite alarmes/navigation Ignition. | Brancher architecture France + statuts alarmes. |
| Synoptique HTA/PTR | P1 | missing | Pas encore de vue synoptique France reconstruite depuis architecture. | Creer une vue lecture seule site/postes/cellules/equipements. |
| Vue onduleurs | P1 | missing | Les onduleurs France sont importes, mais pas de vue operateur equivalent Ignition. | Liste/detail onduleurs en lecture avec etats normalises. |
| Telemetry et tags | P1 | missing | Pas de mapping generique tags Ignition/MQTT vers telemetry normalisee. | Definir `telemetry_points` et simulateur de valeurs. |
| Conduite alarmes/tickets | P2 | missing | Pas de modele `AlarmMaster`/tickets equivalent Ignition. | Ajouter schema read-only et board conduite minimal. |
| Rapports conduite | P2 | missing | Les rapports Ignition ne sont pas repris. | Export CSV/PDF apres modele conduite. |
| Agregateur et prix marche | P3 | missing | Pas de module Streem/EPEX, prix negatif, mode auto/manu ou commandes groupees. | Modeliser prix marche en lecture avant commandes. |
| Reactif Q(U) | P3 | missing | Pas de module reactif equivalent Ignition. | Importer modele `Reactif` et afficher courbes/consignes. |
| Configuration centrale | P3 | partial | Import architecture present, pas de CRUD operateur equivalent Ignition. | Ajouter CRUD seulement apres validation du modele. |
| RBAC metier commandes | P3 | partial | Roles existants peuvent tester en dry-run; pas encore de roles fins commande/live. | Ajouter roles `command_tester`, `command_operator`, `command_approver`. |
| Commandes live terrain | P4 | blocked | Volontairement impossible dans ce lot, meme si env mal configuree. | Debloquer uniquement par environnement, role, commande et validation terrain. |

## Backlog recommande

### Lot 4 - Vue site France read-only

Objectif: rendre les donnees importees utiles pour un operateur sans aucune commande.

Livrables:
- page detail site France basee sur `architecture_sites/:id/tree`;
- sections postes, cellules, equipements et onduleurs;
- etats "inconnu/simule/non connecte" explicites tant que la telemetry n'est pas branchee;
- navigation depuis `/architecture`;
- tests API/front sur chargement site et cas sans donnees.

Pourquoi maintenant: le sandbox contient deja les donnees France. La prochaine valeur visible est de transformer ces donnees en ecran metier, toujours sans risque terrain.

### Lot 5 - Telemetry/tag mapping sandbox

Objectif: preparer la lecture des etats et mesures sans dependance live.

Livrables:
- table/catalogue de points normalises;
- mapping site/poste/equipement/onduleur vers point;
- simulateur de valeurs pour cellules, PTR et onduleurs;
- API de lecture normalisee pour les vues operateur.

### Lot 6 - Synoptique France lecture seule

Objectif: reconstruire l'equivalent de `Vue_Synoptique_Test` sans commande.

Livrables:
- rendu synoptique par site;
- affichage etats cellules/equipements/PTR depuis telemetry sandbox;
- historique evenements de lecture si pertinent;
- aucun bouton de commande actif.

### Lot 7 - Conduite alarmes read-only

Objectif: demarrer la parite `Conduite/ticketView`.

Livrables:
- tables alarmes/tickets ou mapping equivalent;
- import read-only depuis export sanitise;
- board conduite minimal avec filtres;
- statut/categorisation en simulation seulement.

### Lot 8 - Commandes controlees v2

Objectif: renforcer le dry-run avant tout live.

Livrables:
- validations de cible par famille de commande;
- roles metier dedies;
- confirmation forte pour commandes critiques;
- idempotence/rejeu interdit;
- export du journal commandes.

### Lot 9 - Modules metier avance

Objectif: reprendre les modules Ignition apres les fondations lecture/commande.

Livrables:
- agregateur/prix marche;
- reactif Q(U);
- configuration centrale CRUD;
- rapports Ignition remplaces ou reconstruits.

## Regles de decision

- Tout ecran qui ecrit vers le terrain commence par une version lecture seule.
- Toute commande reste derriere `command_service`; pas de publish MQTT/tag direct depuis l'UI.
- Toute donnee extraite de `BDD_Ignition` doit etre read-only, sanitisee si elle est versionnee, et sans secret.
- Le live demande une decision explicite: role metier, environnement, allowlist topic/tag, confirmation, audit et procedure de rollback.
