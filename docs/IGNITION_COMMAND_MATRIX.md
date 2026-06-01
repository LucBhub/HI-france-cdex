# Matrice commandes Ignition France

Date: 2026-06-01

Source: export `Hyperviseur_V3_2026-06-01_1028.zip`

Statut: brouillon extrait automatiquement. A valider avant tout raccordement live.

## Methode d'obtention

La matrice se construit en trois passes:

1. Extraction automatique depuis les vues Perspective:
   - `system.cirruslink.engine.publish(...)`
   - `system.tag.writeAsync(...)`
   - `system.tag.writeBlocking(...)`
   - `system.db.runNamedQuery("Historisation/Commande", ...)`

2. Regroupement par famille metier:
   - cellule HTA
   - DEIE
   - synoptique/PTR
   - onduleurs
   - agregateur
   - parametres de pilotage

3. Validation terrain:
   - libelle exact attendu
   - topic ou tag final
   - payload
   - duree d'impulsion
   - conditions d'autorisation
   - risque et confirmation requise

L'export donne une base solide, mais il ne prouve pas que chaque commande est encore utilisee en production. La validation terrain reste obligatoire avant activation live.

## Matrice initiale

| Famille | Vue Ignition | Commande UI | Transport | Cible observee | Payload observe | Impulsion | Historisation | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cellule HTA | `Commande/Commande` | Ouverture cellule | MQTT ou Tag | `{site}/{poste}/{cellule}/CMD/OUVERTURE...` ou `[MQTT Engine]Edge Nodes/.../CMD_-_Ouverture_...` | `true`, puis `false` | 5 s | `Historisation/Commande` | Fort |
| Cellule HTA | `Commande/Commande` | Fermeture cellule | MQTT ou Tag | `{site}/{poste}/{cellule}/CMD/FERMETURE...` ou `[MQTT Engine]Edge Nodes/.../CMD_-_Fermeture_...` | `true`, puis `false` | 5 s | `Historisation/Commande` | Fort |
| DEIE | `Commande/CMD DEIE` | Autorisation couplage | MQTT ou Tag | `{site}/COMMANDES/...` ou `[MQTT Engine]Edge Nodes/.../DEIE/CMD_-_...` | `true`, puis `false` | a confirmer | `Historisation/Commande` | Critique |
| DEIE | `Commande/CMD DEIE` | Demande decouplage | MQTT ou Tag | `{site}/COMMANDES/...` ou `[MQTT Engine]Edge Nodes/.../DEIE/CMD_-_...` | `true`, puis `false` | a confirmer | `Historisation/Commande` | Critique |
| DEIE | `Commande/CMD DEIE` | Demande decouplage urgent | MQTT ou Tag | `{site}/COMMANDES/...` ou `[MQTT Engine]Edge Nodes/.../DEIE/CMD_-_...` | `true`, puis `false` | a confirmer | `Historisation/Commande` | Critique |
| Synoptique | `Vue_Synoptique_Test` | Acquittement | Tag ou MQTT | `[MQTT Engine]Edge Nodes/REDEN/CARPENTRAS/PDL_PTR/CMD_-_Aquitement` ou `{site}/COMMANDES/Acquittement` | `true`, puis `false` | 5 a 10 s | non systematique | Moyen |
| PTR / Synoptique | `Vue_PTR`, `Vue_Synoptique_Test` | Relance chargeur C13-100 | MQTT ou Tag | `{site}/{poste}/CHARGEUR C13-100/CMD/RELANCE/` ou `[MQTT Engine]Edge Nodes/.../CHARGEUR_C13-100/CMD_-_Relance_chargeur` | `true`, puis `false` | 5 a 10 s | `Historisation/Commande` | Moyen |
| Onduleurs | `Onduleur/Commandes_Onduleur` | Stop onduleur KACO | MQTT | `{site}/{poste}/KACO/CMD/STOP/` | `false` quand switch selectionne, `true` sinon | niveau maintenu | non observee | Fort |
| Onduleurs | `Onduleur/Onduleur (1)` | Stop/start onduleur individuel | MQTT ou Tag | `{site}/{poste}/ONDULEUR/CMD/STOP/` ou `[MQTT Engine]Edge Nodes/.../ONDULEUR...` | `false` ou `true` | niveau maintenu | non observee | Fort |
| Onduleurs PTR | `Onduleur/Onduleur_PTR`, `Onduleur/Vue_Onduleur_PTR` | Stop/start tous onduleurs poste | MQTT ou Tag | `{site}/{poste}/ONDULEUR/CMD/STOP/` ou tags par onduleur | `false` ou `true` | niveau maintenu | non observee | Fort |
| Agregateur | `Agregateur/mode ok_manu`, `Agregateur/Popup confirmation` | Prix negatif / stop general | MQTT et Tag | `CMD/Stop_Agregateur`, `[default]CMD/Stop_general`, tags Edge Nodes par centrale | `false` ou `true` | niveau maintenu | `Historisation/Commande` | Critique |
| Agregateur | `Agregateur/View` | Rapidite donnees Lent/Rapide | MQTT | `{centrale}/CMD/RAPIDITE/` | `false` ou `true` | niveau maintenu | non observee | Faible |
| Agregateur | `Agregateur/mode ok_manu` | Delta stop onduleur | Tag memoire | `[default]_EpexConfig/DelaiStop` | entier minutes | persistant | non observee | Moyen |

## Regles de migration proposees

Toutes les commandes doivent passer par une API unique:

`POST /api/commands`

Exemple de payload cible:

```json
{
  "commandType": "cell.open",
  "site": "CARPENTRAS",
  "poste": "PDL_PTR",
  "equipment": "NED-1",
  "mode": "dry-run",
  "requestedBy": "user",
  "confirmationToken": "required-for-live"
}
```

La couche backend doit ensuite:
- Verifier que la commande est dans une allowlist.
- Verifier le role utilisateur.
- Refuser le live si le mode `dry-run` est actif.
- Construire le topic/tag a partir du mapping valide.
- Publier vers le broker ou simuler la publication.
- Journaliser dans une table commandes.
- Retourner l'etat detaille a l'UI.

## Broker MQTT

Oui, il faut monter un broker, mais pas directement branche au terrain au debut.

Ordre recommande:

1. Broker sandbox local:
   - Mosquitto en Docker.
   - Aucun bridge vers production.
   - Topics de test seulement.
   - UI et backend publient dessus en `dry-run`/simulation.

2. Command service:
   - API centrale.
   - journalisation.
   - allowlist.
   - confirmations.
   - mode `dry-run` par defaut.

3. Simulateur terrain:
   - Souscrit aux topics.
   - Repond avec des etats factices.
   - Permet de tester carte, synoptique, onduleurs, agregateur.

4. Bridge production:
   - A ajouter seulement apres validation de la matrice.
   - Avec ACL topic par topic.
   - Avec environnement distinct de preproduction.

## Roles provisoires

Decision provisoire: tous les utilisateurs peuvent voir et tester les commandes en simulation.

Important:
- Cela ne doit pas signifier "tout le monde peut commander le live".
- Tant que la validation n'est pas faite, l'API doit rester en `dry-run`.
- Le passage live doit etre une configuration explicite par environnement et par commande.

## Questions a valider plus tard

- Les payloads `true/false` sont-ils bien ceux attendus partout ?
- Les commandes maintenues doivent-elles rester maintenues ou etre impulsionnelles ?
- Les cas speciaux `CARPENTRAS`, `BRINS_VERTS`, `AUGIER_3`, `PLAN_AURON` existent-ils encore ?
- Quel mapping exact entre `Client = MQTT` et `Client != MQTT` doit etre conserve ?
- Les commandes agregateur sont-elles toujours pilotees par `CMD/Stop_Agregateur` ?
- Quels topics doivent etre ACL en lecture/ecriture ?
