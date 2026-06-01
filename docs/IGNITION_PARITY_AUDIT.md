# Audit de parite Ignition France

Date: 2026-06-01

Sources inspectees:
- Repo web: `C:\Users\l.boillat\Repos\Hyperviseur`
- Export Ignition: `C:\Users\l.boillat\Downloads\Hyperviseur_V3_2026-06-01_1028.zip`
- Projet exporte: `Hyperviseur_V3`

Note de securite:
- Aucune commande live terrain n'a ete declenchee.
- Les identifiants fournis oralement ne doivent pas etre stockes dans le repo, ni utilises en ligne de commande.
- L'export Ignition contient des scripts avec secrets externes et numeros de telephone. Ils doivent etre sortis en variables d'environnement ou vault avant toute reprise.

## Perimetre observe dans Ignition

L'export contient:
- 153 vues Perspective.
- 161 named queries SQL.
- 20 scripts Python projet.
- 42 groupes SQLBridge.
- 4 rapports Ignition.

Pages principales Perspective:
- `Test_Maps`: carte France avec marqueurs de centrales, alarmes et navigation.
- `Vue_Synoptique_Test`: synoptique HTA/PTR avec etats, mesures, acquittements et commandes.
- `Vue_Onduleur`: vue onduleurs, etats, puissance AC et commandes stop/start.
- `Vue_Reactif`: regulation/reactif avec courbe Q(U), consignes, seuils et mesures.
- `Agregateur`: regroupement par agregateur, prix marche, commandes arret/demarrage onduleurs, mode prix automatique.
- `Conduite/ticketView`: gestion alarmes/tickets, filtres, affectation, alarmes manuelles, rapports.
- `Configuration/Config`: ajout, modification et suppression de sites/postes/cellules/equipements/onduleurs.

Navigation partagee:
- Dock gauche: Information, Synoptique, Onduleur, MES.
- Dock haut: Maps, Agregateur, Feedback, Configuration Centrale, Conduite, selection de site.

## Modele de donnees Ignition

Schemas et tables les plus structurantes:
- `dev_ignition.Sites`
- `dev_ignition.Clients`
- `dev_ignition.type_postes`
- `dev_ignition.Cellules`
- `dev_ignition.Equipements`
- `dev_ignition.Onduleurs`
- `dev_ignition.lien_Sites_type_postes`
- `dev_ignition.lien_sites_typepostes_cellules`
- `dev_ignition.lienSites_postes_equipements`
- `dev_ignition.lienSites_postes_onduleurs`
- `dev_ignition.AlarmMaster`
- `dev_ignition.Alarms`
- `dev_ignition.AlarmReasons`
- `dev_ignition.cmd_history`
- `dev_ignition.market_price`
- `dev_ignition.market_price_streem`
- `dev_ignition.Reactif`
- `dev_ignition.tickets`
- `dev_ignition.ticketmaster`

La requete `Architecture/Create_Tag` construit le modele Site -> Poste -> Cellules/Equipements/Onduleurs. C'est la cle de migration pour remplacer les tags Perspective par un modele applicatif propre.

## Commandes terrain observees

Zones qui ecrivent vers tags ou MQTT:
- `Commande/Commande`: commandes cellule, historisation `Historisation/Commande`.
- `Commande/CMD DEIE`: commandes DEIE et autorisation de couplage.
- `Vue_Synoptique_Test`: acquittement, relance chargeur, commandes liees au synoptique.
- `Vue_PTR`: commandes PTR, relance chargeur et etats securite.
- `Onduleur/*`: stop/start onduleurs, support MQTT et tag write selon client.
- `Agregateur/mode ok_manu` et `Popup confirmation`: commandes groupees sur centrales agregees.
- `Agregateur/View`: rapidite de rafraichissement via MQTT.

Concepts de commande identifies:
- Couplage centrale.
- Demande decouplage.
- Demande decouplage urgent.
- Autorisation couplage.
- Acquittement.
- Relance chargeur.
- Stop/start onduleur.
- Stop general agregateur.

Toute migration doit introduire une couche `command_service` avec:
- dry-run/simulateur par defaut.
- confirmation forte cote UI pour couplage/decouplage et commandes groupees.
- RBAC dedie, plus fin que `member/admin`.
- journal immuable des commandes.
- allowlist de tags/topics.
- verrouillage production/live tant que la matrice des commandes n'est pas validee.

## Etat actuel du repo web

Stack:
- Next.js frontend.
- Backend Express.
- PostgreSQL via Knex.
- Service de polling Modbus.
- Service de defauts relais.
- Jobs d'agregation horaire et irradiation.

Fonctionnalites deja presentes:
- Authentification locale/Azure.
- Dashboard carte centrales.
- Page centrale detaillee.
- Relais Thytronic/Siprotec, mesures Modbus, defauts, acquittement.
- Commandes couple/decouple/reset sur relais.
- Parametrage de centrales et modeles d'appareils.
- Rapports basiques et historiques mesures.
- Audit logs.

Limites actuelles par rapport a Ignition:
- Le modele actuel `plants/relays` ne couvre pas l'architecture France Site/Poste/Cellule/Equipement/Onduleur.
- Pas de modele generique de tags ou mapping MQTT equivalent a `[default]...` et `[MQTT Engine]...`.
- Pas de module Conduite complet avec `AlarmMaster`, workflow, assignation, intervention evitee/non evitee, alarme manuelle, rapport CSV.
- Pas de module Agregateur/prix marche equivalent Streem/EPEX, commandes groupees, mode auto/manu, historique commandes.
- Pas de module Reactif Q(U) exploitable.
- Pas de configuration centrale equivalant aux ecrans Ignition.
- Pas de reprise des rapports Ignition.
- Les endpoints de commande acceptent encore `member` pour des actions sensibles.

## Matrice de parite priorisee

P0 - securite et socle:
- Externaliser tous les secrets du repo et de l'export.
- Corriger RBAC commandes: commandes terrain reservees a un role explicite.
- Ajouter `command_service` avec simulation, journalisation, confirmation, allowlist et idempotence.
- Ajouter modele SQL cible pour architecture France.

P1 - lecture et supervision:
- Importer `dev_ignition.Sites` et relations postes/cellules/equipements/onduleurs.
- Refaire `Test_Maps` avec filtres alarmes et navigation site.
- Refaire `Vue_Synoptique_Test` en lecture seule d'abord.
- Ajouter vue onduleurs en lecture: etats, puissance AC, details popup.

P2 - conduite:
- Implementer `AlarmMaster/Alarms/AlarmReasons` ou mapper vers un nouveau schema equivalent.
- Ajouter board Conduite: colonnes par statut, filtres site/CE/categorie, detail ticket, update statut, categorisation.
- Ajouter alarme manuelle.
- Ajouter export rapport conduite.
- Ajouter notifications/rappels sans secrets hardcodes.

P3 - commandes controlees:
- Cellules/DEIE: commandes via service centralise, confirmation et historisation.
- Onduleurs: stop/start individuel et groupe.
- Synoptique: acquittement et relance chargeur.
- Agregateur: commandes groupees seulement apres validation d'une sandbox.

P4 - modules metier:
- Agregateur prix marche: import Streem/EPEX, table prix, detection prix negatif, mode auto/manu, historique.
- Reactif: Q(U), consignes, seuils, historique et validation metier.
- Configuration: CRUD site/poste/cellule/equipement/onduleur.
- Rapports Ignition: conduite, historisation evenements, exports.

## Donnees complementaires utiles

Pour aller plus loin sans risque, il faudrait idealement:
- Un acces SQL read-only a `BDD_Ignition` pour comparer schema reel, cardinalites et exemples de donnees.
- Un dump schema-only ou backup sanitise des tables `dev_ignition.*`.
- La liste officielle des roles metier autorises a commander.
- Une matrice validee des commandes: libelle UI, tag/topic, payload, duree impulsion, conditions d'autorisation, risque.
- Un environnement de test MQTT/tag, ou un broker sandbox, avant toute commande.
- Les attentes metier sur les priorites: carte/synoptique, conduite, agregateur, reactif, configuration.

## Hypothese d'architecture cible

Backend:
- `architecture` pour sites/postes/cellules/equipements/onduleurs.
- `telemetry` pour mesures et etats normalises.
- `alarms`/`conduite` pour workflow.
- `commands` pour toutes les actions terrain.
- `market` pour prix et agregateur.
- `reactive` pour Q(U).

Frontend:
- Dashboard carte France.
- Layout avec bandeau haut et navigation site.
- Vues site: Information, Synoptique, Onduleurs, MES/PTR.
- Modules globaux: Conduite, Agregateur, Configuration, Rapports.

La migration doit commencer en lecture seule, puis activer les commandes par perimetre valide.
