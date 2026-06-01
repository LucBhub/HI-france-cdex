# Architecture Code Détaillée – H I²

**Document Réservé aux Développeurs et Équipe Technique**  
Ce document détaille la structure interne du code, les fichiers critiques, et la logique d'implémentation bas niveau.

---

## 1. Arborescence du Projet

```mermaid
graph TD
    Root[Hyperviseur - antigravity]
    Frontend[src (Next.js)]
    Backend[backend (Node.js)]
    Docs[docs]

    Root --> Frontend
    Root --> Backend
    Root --> Docs

    Frontend --> Components[src/components]
    Frontend --> App[src/app]
    Frontend --> Lib[src/lib]

    Components --> Dashboard[dashboard/]
    Components --> Plant[plant/]
    Components --> Settings[settings/]

    Backend --> Index[index.js (API Entry)]
    Backend --> Polling[polling-service.js (Worker)]
    Backend --> Cron[cron/]
    Backend --> DB[db/migrations]
```

## 2. Frontend (Next.js - `src/`)

### 2.1 Composants Critiques

#### **Plante & Supervision** (`src/components/plant/`)

- **`analysis-view.tsx`** :
  - **Rôle** : Cœur de l'analyse graphique (Courbes de charge).
  - **Implémentation** : Utilise `recharts`. Logique complexe pour fusionner les données `measurements` (Discontinu) et `irradiation` (Continu).
  - **Attribut Clé** : `connectNulls={true}` sur les courbes `<Area />` et `<Line />` pour gérer les trous de données (restarts, pannes).
  - **Hook** : Appelle `/api/plants/:id/analysis`.

- **`thytronic-relay-card.tsx`** :
  - **Rôle** : Affichage temps réel d'un relais spécifique.
  - **Logique** : Rafraîchissement automatique. Affiche une vue simplifiée (Jauges) ou détaillée (Tableau).

- **`power-control-card.tsx`** :
  - **Rôle** : Bloc de commande (Open/Close/Reset).
  - **Sécurité** : Demande confirmation. Appelle `POST /api/control`. Gestion des états de chargement pour éviter le double-cliq.

#### **Tableau de Bord** (`src/components/dashboard/`)

- **`plant-map.tsx`** :
  - **Tech** : `react-leaflet` + `leaflet.markercluster`.
  - **Logique** :
    - Rouge : Alarme non acquittée ou statut "Alarm".
    - Gris : `status === 'offline'`.
    - Vert : Normal.
  - **Code Clé** : `divIcon` personnalisé pour afficher le nombre de centrales dans un cluster.

#### **Paramètres** (`src/components/settings/`)

- **`device-models-settings.tsx`** :
  - **Rôle** : Éditeur JSON visuel pour les profils Modbus.
  - **Format** : Stocke la config (Adresses registres, facteurs K) en JSON dans la table `device_models`. C'est ici qu'on définit comment lire un nouveau type de relais sans toucher au code backend.

### 2.2 Gestion de l'État et Authentification

- **`src/components/with-auth.tsx`** : HOC (Higher Order Component) qui protège les routes. Vérifie la présence du token JWT dans `localStorage`.
- **`src/lib/api.ts`** : Wrapper `fetch` qui injecte automatiquement `Authorization: Bearer ...`.

---

## 3. Backend (Node.js - `backend/`)

### 3.1 Point d'Entrée (`index.js`)

- **Serveur Express** classique.
- **Middleware** : `cors`, `bodyParser`, `authMiddleware` (validation JWT).
- **Routes API** :
  - `/api/auth/login` : Délivre le JWT (Local).
  - `/api/auth/azure/*` : Gestion OAuth2 Microsoft (Code Grant).
  - `/api/plants` : CRUD Centrales.
  - `/api/control` : Proxy vers les commandes Modbus (via écriture directe ou files d'attente).
  - `/api/alarms` : Récupération des défauts (Actifs vs Historiques).

### 3.2 Service de Polling (`polling-service.js`)

C'est le **cœur du système temps réel**. Il tourne en parallèle de l'API (via Docker `command: npm run poll`).

**Flux d'Exécution (`runPollingCycle`) :**

1. **Fetch Plants** : Récupère la liste des centrales actives.
2. **Pour chaque Centrale** :
   - Itère sur les relais (IP:Port).
   - Ouvre une socket TCP (`modbus-serial`).
   - **Lecture Dynamique** : Lit les registres définis dans le `deviceModel` associé.
     - _Exemple_ : Si le modèle dit "Voltage L1 à l'adresse 399", il lit 399.
   - **Calculs** : Applique les facteurs K (Ex: `/16000` pour un courant).
   - Gère l'Endianness (Swap vs Big Endian).
   - Agrège les puissances (Somme des relais) pour la centrale.
   - **Update API** : Envoie un `PUT /api/plants/:id` avec les nouvelles valeurs instantanées.

**Logique d'Historisation (`initHistorizationState` + Boucle) :**

- Au démarrage, appelle `/api/plants/:id/measurements/latest` pour savoir quand on a sauvegardé pour la dernière fois.
- Stocke ce timestamp en mémoire (`lastHistorization`).
- À chaque cycle, calcule `Delta = Now - Last`.
- Si `Delta >= 10 min`, déclenche `POST /api/plants/:id/measurements`.
- _Sécurité_ : Prévient les "trous" de données lors des redémarrages de conteneurs.

### 3.3 Services Cron (`backend/cron/`)

- **`irradiation-fetcher.js`** :
  - Horaire : 01:00 AM.
  - Appelle l'API Open-Meteo pour J-1.
  - Stocke dans `irradiation_hourly`.
  - _Logique de rattrapage_ : Si la veille est vide, il tente de la remplir.
- **`aggregator.js`** :
  - Horaire : H+5min (ex: 10:05).
  - Calcule `AVG(power_kw)` depuis la table `measurements` pour l'heure passée.
  - Insère dans `measurements_hourly`.
  - Vide les `measurements` vieux de > 30 jours.

### 3.4 Gestion des Défauts (`fault-service.js` & `faults.js`)

- **`faults.js`** : Contient le dictionnaire statique des codes défauts Thytronic (ex: `Ansicode 50/51` = Surintensité).
- **`fault-service.js`** :
  - Analyse les registres d'état (Bitmask).
  - Détecte les fronts montants (Nouveau défaut).
  - Crée une entrée dans la table `alarms`.
  - Gère l'acquittement (Bit passe à 0 -> Statut 'recovered' ou supprimé selon la logique).

---

## 4. Base de Données & Migrations

Le projet utilise **PostgreSQL** (v15) comme moteur de base de données principal.

### Configuration

- **Production (Docker)** : Connexion au service `postgres` via le port 5432.
- **Développement** : Connexion possible au port host **5433**.

Le schéma est versionné via **Knex.js** (`backend/db/migrations/`).
Les migrations supportent désormais la syntaxe PostgreSQL (types, JSON, dates).

**Commandes Utiles :**

- `npm run migrate` : Applique les changements.
- `npm run migrate:rollback` : Annule le dernier changement.

---

## 5. Scripts de Diagnostic & Maintenance

| Fichier                      | Usage                                   | Commande                                           |
| ---------------------------- | --------------------------------------- | -------------------------------------------------- |
| `backend/scripts/backup.sh`  | Dump complet de la BDD (rétention 7j).  | `docker exec hyperviseur-backup backup.sh`         |
| `backend/scripts/restore.sh` | Restaure la BDD depuis un fichier dump. | `docker exec hyperviseur-backup restore.sh <file>` |
| `check_registers.js`         | Lit une plage de registres bruts.       | `node check_registers.js <IP> <Start> <Count>`     |

---

## 6. Variables d'Environnement (.env)

| Variable                | Description                        | Valeur par Défaut                            |
| ----------------------- | ---------------------------------- | -------------------------------------------- |
| `HOST_IP`               | IP de la machine (pour accès LAN). | `localhost`                                  |
| `DB_HOST`               | Hôte SGBD.                         | `postgres` (interne) / `localhost` (externe) |
| `DB_PORT`               | Port SGBD.                         | `5432` (interne) / `5433` (externe)          |
| `DB_USER`               | Utilisateur BDD.                   | `postgres`                                   |
| `DB_PASS`               | Mot de passe BDD.                  | `postgres`                                   |
| `DB_NAME`               | Nom de la base.                    | `hyperviseur`                                |
| `JWT_SECRET`            | Clé de signature des tokens.       | _Secret_                                     |
| `POLLING_SERVICE_TOKEN` | Token inter-service.               | _Généré_                                     |
| `AZURE_*`               | Tenant, ClientID, Secret.          | _Requis pour MS Auth_                        |

---

## 7. Modifications & Extension du Code

### Ajouter un nouveau Type de Relais

1. Ne **pas** modifier le code JS.
2. Aller dans l'interface **Paramètres > Modèles Appareils**.
3. Créer un nouveau JSON avec les adresses registres du constructeur.
4. Sauvegarder. Le `polling-service` rechargera la config au prochain cycle.

### Ajouter une colonne en Base de Données

1. Créer une migration : `npx knex migrate:make add_column_name`.
2. Éditer le fichier généré dans `backend/db/migrations`.
3. Lancer `npm run migrate` (ou redémarrer le conteneur backend qui le fait au boot).

---

_Fin du document d'architecture détaillée._
