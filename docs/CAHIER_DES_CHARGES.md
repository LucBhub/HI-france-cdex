# Cahier des Charges – H I² (Hyperviseur Solaire)

## 1. Contexte et Objectifs

### 1.1 Contexte du Projet

L'exploitation de centrales de production d'énergie solaire nécessite une surveillance constante des équipements de protection et de couplage au réseau. Actuellement, la gestion de ces équipements, notamment les relais de protection de marque **Thytronic (série XMR)**, requiert souvent des interventions locales ou l'utilisation de logiciels propriétaires disparates.

Dans un **contexte multi-sites**, il est crucial de disposer d'une solution centralisée capable d'agréger les données de plusieurs centrales et d'offrir une interface de pilotage unifiée.

### 1.2 Objectifs Principaux

Le projet "H I²" vise à développer une application web permettant de :

- **Centraliser la supervision** : Offrir une vue globale et temps réel de l'état de production et de connexion de l'ensemble du parc de centrales.
- **Sécuriser l'exploitation** : Permettre la visualisation immédiate des défauts et de la position des disjoncteurs (Ouvert/Fermé).
- **Optimiser la maintenance** : Autoriser le pilotage à distance (télécommande) des organes de coupure pour les opérations de maintenance ou de gestion de réseau, réduisant ainsi les déplacements physiques.
- **Standardiser l'interface** : S'affranchir des spécificités techniques de chaque automate grâce à une couche d'abstraction logicielle (_Device Models_).

---

## 2. Description du Besoin

### 2.1 Besoins Fonctionnels

L'application doit répondre aux besoins suivants pour les opérateurs et administrateurs :

- **Supervision en Temps Réel** :
  - Affichage des mesures électriques critiques : Tensions (U), Courants (I), Fréquence (F).
  - Calcul et affichage des puissances : Active (P), Réactive (Q) et Apparente (S).
  - Rafraîchissement des données avec une latence minimale (Polling régulier).

- **Gestion d'États** :
  - Remontée fiable de la position physique des disjoncteurs (Open/Closed) via les registres Modbus appropriés.
  - Indication claire de l'état de communication (Online/Offline) pour chaque équipement.

- **Télécommande (Command & Control)** :
  - Capacité d'envoyer des ordres de fermeture (Couple) et d'ouverture (Decouple) sécurisés.
  - Possibilité d'acquitter les défauts (Reset).

- **Flexibilité et Configuration** :
  - Ajout/Suppression de centrales et de relais sans redémarrage de l'application.
  - Configuration des adresses Modbus via une interface graphique (_Device Models_) pour supporter de futures versions de matériels Thytronic ou d'autres marques.

### 2.2 Besoins Non-Fonctionnels

- **Ergonomie** : Interface intuitive, mode sombre/clair, responsive design (PC/Tablette).
- **Internationalisation** : Support natif du Français, de l'Anglais et de l'Italien.
- **Performance** : Capacité à gérer plusieurs dizaines de relais simultanément sans dégradation de l'interface.

---

## 3. Architecture Technique

Le système repose sur une architecture microservices conteneurisée via **Docker** :

- **Frontend** : **Next.js** (React / TypeScript) pour l'interface utilisateur.
- **Backend** : **Node.js/Express** pour l'API REST et la logique métier.
- **Service de Polling** : Service dédié (Node.js) pour la communication **Modbus TCP** asynchrone.
- **Base de Données** : **SQLite** pour la persistance légère et portable.

---

## 4. Contraintes et Risques

### 4.1 Contraintes Techniques

- **Protocole de Communication** : Utilisation stricte du protocole **Modbus TCP**. L'application doit gérer les spécificités de ce protocole (adressage, types de données, endianness).
- **Environnement Réseau** : Les équipements sont situés sur des réseaux distants accessibles via IP. L'application doit gérer les latences variables et les coupures réseaux intermittentes.
- **Compatibilité Matérielle** : Le système doit s'interfacer prioritairement avec les relais Thytronic XMR, tout en restant ouvert à d'autres modèles via configuration.

### 4.2 Risques Identifiés et Mesures d'Atténuation

| Risque                         | Impact                                                              | Mesure d'Atténuation                                                                                              |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Perte de contrôle critique** | Impossibilité d'ouvrir un disjoncteur en cas d'urgence.             | Mise en place de mécanismes de "Retry" automatique et indication visuelle claire de l'échec de commande.          |
| **Fausse manœuvre**            | Ouverture/Fermeture accidentelle d'un disjoncteur par un opérateur. | Restriction des commandes aux rôles autorisés (Admin/Superadmin) et pop-up de confirmation avant action.          |
| **Incohérence des données**    | Affichage d'un état "Fermé" alors que le disjoncteur est "Ouvert".  | Validation rigoureuse des registres Modbus et gestion des statuts "Inconnu" ou "Erreur".                          |
| **Sécurité Informatique**      | Accès non autorisé aux commandes de pilotage.                       | Authentification forte via JWT, hachage des mots de passe (bcrypt), et séparation stricte des rôles utilisateurs. |
| **Surcharge du réseau**        | Le polling fréquent sature la bande passante ou l'automate.         | Optimisation du cycle de polling (60s par défaut, configurable) et regroupement des requêtes Modbus.              |

---

## 5. État d'Avancement (Décembre 2025)

Les fonctionnalités suivantes ont été livrées et validées :

- [x] **Supervision Temps Réel** : Modbus TCP opérationnel avec Thytronic XMR.
- [x] **Contrôle** : Commandes Open/Close/Reset sécurisées.
- [x] **Historisation** : Base de données SQLite avec agrégation automatique et API Irradiation.
- [x] **Analyse** : Graphiques de production vs irradiation (Recharts).
- [x] **Cartographie** : Clustering et statuts dynamiques.
- [x] **Sécurité** : JWT implémenté, Audit Logs actifs.
- [x] **Déploiement** : Dockerisé + Scripts PowerShell pour gestion IP dynamique.
