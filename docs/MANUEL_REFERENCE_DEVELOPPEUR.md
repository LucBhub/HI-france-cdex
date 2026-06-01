# Manuel de Référence Développeur – H I²

**Version** : 2.0.0 "Deep Dive"  
**Dernière mise à jour** : 17 Décembre 2024  
**Audience** : Architectes, Développeurs Confirmés, DevOps.

---

> Ce document est la "Bible" technique du projet. Il détaille chaque couche, chaque service et chaque fichier critique.  
> **Note** : Ce manuel a été écrit au fur et à mesure du développement. Certaines sections peuvent être incomplètes ou obsolètes. N'hésitez pas à le mettre à jour si vous trouvez des erreurs ou des manques.

## Table des Matières

1.  **Architecture Bas Niveau**
    - 1.1 Vue d'Ensemble des Conteneurs
    - 1.2 Diagramme de Séquence : Flux de Données Complet
    - 1.3 Gestionnaire de Processus (Docker Compose)
2.  **Partie Backend (Node.js/Express)**
    - 2.1 Séquence de Démarrage (`index.js`)
    - 2.2 Middleware d'Authentification (`authMiddleware`)
    - 2.3 API Référence (Endpoints)
      - Authentification
      - Centrales (`Plants`)
      - Commandes (`Control`)
      - Configuration (`Device Models`)
    - 2.4 Service de Polling (`polling-service.js`)
      - Logique de la Machine à États
      - Gestion de l'Endianness Modbus
      - Mécanisme de "Retry" et Timeout
3.  **Partie Frontend (Next.js / React)**
    - 3.1 Structure du Projet (`src/`)
    - 3.2 Gestion de l'État Global (Context vs SWR)
    - 3.3 Composants Critiques
      - `AnalysisView` (Moteur de Graphiques)
      - `PlantMap` (Leaflet Integration)
      - `DeviceModelWizard` (Générateur JSON)
4.  **Base de Données (SQLite)**
    - 4.1 Schéma Relationnel Complet (DDL)
    - 4.2 Stratégie d'Indexation
    - 4.3 Migrations (Knex.js)
5.  **Infrastructure et Déploiement**
    - 5.1 Analyse du `Dockerfile` (Multi-stage Build)
    - 5.2 Variables d'Environnement (`.env`)
    - 5.3 Scripts d'Exploitation (Backup, Restore)
6.  **Sécurité**
    - 6.1 Modèle RBAC (Role-Based Access Control)
    - 6.2 Sécurisation des Communications Inter-Services
7.  **Module Rapports & Analyses**
    - 7.1 Architecture du Module
    - 7.2 Logique de Dé-doublonnage des Interventions
    - 7.3 Algorithmes de Détection d'Anomalies
    - 7.4 Composants Frontend
8.  **Algorithmes Clés Détaillés**
9.  **Limites actuelles et points à améliorer**

---

## 1. Architecture Bas Niveau

L'application suit une architecture **Micro-services simplifiée**, orchestrée par Docker Compose.

### 1.1 Vue d'Ensemble des Conteneurs

- **`frontend` (Next.js)** :
  - Sert l'application React (SSR + Client).
  - Communique avec le `backend` via HTTP (API REST).
  - N'a **aucun** accès direct à la Base de Données ni au réseau Modbus.

- **`backend` (Express.js)** :
  - API Gateway & Business Logic.
  - Gère l'Authentification (JWT).
  - Exécute les CRON jobs (Agrégation, Fetch Météo).
  - Connecté à PostgreSQL.

- **`postgres` (Base de Données)** :
  - Image : `postgres:15-alpine`.
  - Volume : `postgres_data` (Persistant).
  - Expose le port 5432 (interne) et 5433 (hôte).

- **`backup-service` (Maintenance)** :
  - Conteneur utilitaire ("Sidecar").
  - Exécute un script de backup (`pg_dump`) toutes les 24h.
  - Gère la rotation des fichiers (7 jours).

- **`polling-service` (Node.js Worker)** :
  - Service "Headless" d'acquisition Modbus.
  - Service "Headless" (sans port HTTP exposé publiquement).
  - Boucle infinie de lecture Modbus TCP.
  - Communique avec le `backend` uniquement via API interne (`http://backend:3001`).
  - Authentifié via `X-Service-Token`.

---

## 2. Partie Backend (Node.js/Express)

Fichier principal : `backend/index.js` (600+ lignes).

### 2.1 Séquence de Démarrage

1.  **Charge les variables d'env** (`dotenv`).
2.  **Initialise Knex** (Connexion **PostgreSQL**).
3.  **Migration DB** : Exécute `knex.migrate.latest()` au démarrage.
4.  **Check Superadmin** : Si aucun compte `superadmin` n'existe, en crée un à partir des variables d'env (`SUPERADMIN_USERNAME`...).
5.  **Start Express** : Écoute sur le port 3001.
6.  **Start Cron Jobs** : Lance `irradiation-fetcher` et `aggregator`.

### 2.2 Middleware d'Authentification (`authMiddleware`)

Fonction critique : `const authMiddleware = (roles = []) => { ... }`

**Logique de validation :**

1.  **Service Token Bypass** : Vérifie l'en-tête `X-Service-Token`. Si ce token correspond à `ENV.POLLING_SERVICE_TOKEN`, la requête est acceptée avec le rôle `superadmin` (User ID `null`). Ceci permet au worker d'écrire en base sans login utilisateur.
2.  **Bearer Token** : Vérifie l'en-tête `Authorization: Bearer <JWT>`.
3.  **Signature** : Valide la signature JWT avec `JWT_SECRET`.
4.  **Expiration** : Rejette les tokens expirés (8h).
5.  **Contrôle de Rôle (RBAC)** : Si le paramètre `roles` est fourni (ex: `['admin']`), vérifie que `decoded.role` est dans la liste. Sinon `403 Forbidden`.

### 2.3 API Référence (Endpoints)

#### Authentification et Utilisateurs

- `POST /api/auth/login` : Authentification locale (Superadmin). Renvoie un JWT.
- `GET /api/auth/azure/login` : Redirection vers Microsoft Entra ID (OIDC).
- `GET /api/auth/azure/callback` : Réception du code Azure, échange contre Token, et création automatique de l'utilisateur (Auto-provisioning avec rôle Admin).
- `GET /api/users` : Liste les utilisateurs (Superadmin only).
- `POST /api/users` : Crée un utilisateur local.

#### Centrales (`Plants`)

- `GET /api/plants` : Renvoie la liste complète + Statut calculé + Relais imbriqués.
- `GET /api/plants/:id` : Détail d'une centrale.
  - _Note_ : Le champ `status` est dynamique (Online/Offline) basé sur le delta `lastDataReceived` < 5 min.
- `POST /api/plants` : Création complète (Centrale + Relais).

#### Commandes (`Control`)

- `POST /api/plants/:id/relays/:relayId/control` :
  - Payload : `{ command: 'couple' | 'decouple' | 'reset' }`.
  - Logique : Envoie l'ordre au `polling-service`.
  - **Feedback** : Le frontend implémente une vérification en 2 étapes (Toast "Envoyé" -> Toast "Vérifié" quand le registre d'état change physiquement).
  - Sécurité : Audit Log `COMMAND_SENT`.

### 2.4 Service de Polling (`polling-service.js`)

Ce service est critique pour l'acquisition de données.

**Boucle Principale (`runPollingCycle`) :**

1. Récupère la liste des centrales via API Backend.
2. Pour chaque centrale, récupère la liste des relais.
3. Pour chaque relais :
   - Ouvre une connexion TCP (`client.connectTCP`).
   - **Phase 1 : Identification** (Optionnel).
   - **Phase 2 : Lecture "Nominales"** (Uniquement si pas en cache). Lit `Inp`, `Unp` pour calculer `Pn`.
   - **Phase 3 : Lecture "Mesures"**. Lit les adresses définies dans le modèle JSON.
   - **Phase 4 : Conversion**.
     - Applique les facteurs d'échelle (ex: `/1000`).
     - Gère le _Word Swap_ pour les variables `LONG` (Tensions). La fonction `parseSwappedLong` réassemble les octets `[CD AB]` au lieu de `[AB CD]`.
   - **Phase 5 : Envoi**. Pousse les données JSON vers `PUT /api/plants/:id` (mise à jour temps réel) et `POST /api/measurements` (si intervalle > 10 min).

**Mécanisme de Robustesse :**

- **Historisation** : Ne se fie pas à un minuteur interne. Interroge `/api/plants/:id/measurements/latest` pour connaître le timestamp du dernier point _réellement_ en base. Si `Now - Last > 10min`, sauvegarde.
- **Erreur TCP** : Si la connexion échoue (`ETIMEDOUT`, `ECONNREFUSED`), passe au relais suivant. Ne crashe pas le service. Tente de se reconnecter au cycle suivant (60s).

---

## 3. Partie Frontend (Next.js / React)

### 3.1 Structure du Projet

Basé sur **Next.js 15 App Router**.

- `src/app/` : Routes (Pages).
  - `page.tsx` : Dashboard (Redirection vers `/dashboard`).
  - `dashboard/page.tsx` : Vue Carte.
  - `plants/[id]/page.tsx` : Vue Centrale détaillée.
- `src/components/` :
  - `ui/` : Composants atomiques (Boutons, Cards) issus de **ShadcnUI** (Radix Primitives + Tailwind).
  - `plant/` : Composants métiers complexes (`AnalysisView`, `ThytronicRelayCard`).

### 3.2 Gestion de l'État

- **Server State** : Utilise `useEffect` + `fetch` dans des hooks personnalisés (`usePlantData`). Pas de React Query / SWR pour l'instant (Plan d'amélioration possible).
- **Auth State** : `AuthContext` (`src/contexts/auth-context.tsx`) stocke le User et le Token. Persiste dans `localStorage`.
- **Theme State** : `next-themes` pour le toggle Dark/Light mode.

### 3.3 Composants Critiques

#### `AnalysisView` (`src/components/plant/analysis-view.tsx`)

C'est le composant le plus complexe du frontend.

- **Rôle** : Afficher les courbes de charge (Puissance) et d'Irradiation.
- **Fonctionnalités avancées** :
  - **Navigation** : Sélecteur de période (24h, 7j, 30j) + **Calendrier** (`react-day-picker`) pour explorer le passé jour par jour.
  - **Interpolation Intelligente** :
    - Pour éviter les lignes diagonales la nuit : Si `Irradiance == 0`, la puissance est forcée à 0 (rupture de courbe).
    - Pour éviter les trous en journée (perte de paquet) : Si `Irradiance > 0` et absence de données, une interpolation linéaire est créée manuellement.
  - **Refresh** : Remount complet du graphique (`key={range}`) pour éviter les artefacts visuels de Recharts.

#### `DeviceModelWizard` (`src/components/settings/device-model-wizard.tsx`)

- **Rôle** : Interface No-Code pour ajouter des types de relais.
- **Logique** :
  - Formulaire à étapes.
  - Valide le JSON de configuration.
  - Permet de tester une adresse Modbus en direct (feature "Test Connect") en appelant le backend qui fait un `modbus.read` ponctuel.

---

## 4. Base de Données (SQLite)

Fichier : `backend/db/hyperviseur.sqlite3`.

### 4.1 Schéma Relationnel Complet

**Table `plants`**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | Auto-increment. |
| `name` | TEXT | Nom unique. |
| `status` | TEXT | 'operational', 'maintenance', 'offline'. |
| `powerKwc` | REAL | Puissance installée (info). |
| `lastDataReceived` | DATETIME | Timestamp UTC de la dernière réception de données (pour calcul statut). |
| ... | ... | Champs d'adresse, login modem, etc. |

**Table `relays`**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | |
| `plantId` | INTEGER FK | Lien vers `plants.id` (ON DELETE CASCADE). |
| `ipAddress` | TEXT | IPv4. |
| `port` | INTEGER | Défaut 502. |
| `unitId` | INTEGER | ID Esclave Modbus (Défaut 1). |
| `modelId` | TEXT | Référence vers `device_models.id` (ex: 'thytronic-xmr-a'). |

**Table `measurements` (Données Chaudes)**
| Colonne | Type | Index | Description |
|---------|------|-------|-------------|
| `id` | PK | | |
| `plant_id` | FK | | |
| `timestamp` | DATETIME | **INDEXED** | Vital pour les requêtes `WHERE timestamp BETWEEN X AND Y`. |
| `power_kw` | REAL | | Puissance instantanée totale. |
| `voltage_v` | REAL | | Moyenne des tensions. |
| `current_a` | REAL | | Somme ou moyenne (selon config) des courants. |

**Table `audit_logs`**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | PK | |
| `user_id` | FK | Peut être NULL si User supprimé. |
| `username` | TEXT | Copie du nom pour historique. |
| `action` | TEXT | Enum: 'LOGIN', 'PLANT_CREATE', 'COMMAND_SENT'. |
| `details` | JSON | Payload variabilisé selon l'action. |

### 4.2 Stratégie d'Indexation

- `measurements(plant_id, timestamp)` : Index composite vital pour la perfs des graphiques (Filter by plant AND range).
- `audit_logs(created_at)` : Pour l'affichage trié.

---

## 5. Infrastructure et Déploiement

### 5.1 Analyse du `Dockerfile` (Multi-stage Build)

Le Dockerfile racine utilise une stratégie multi-étapes pour réduire la taille de l'image (de 1Go+ à ~150Mo).

1.  **Stage `deps`** :
    - `FROM node:18-alpine`.
    - `COPY package.json`. `RUN npm install`.
    - But : Mettre en cache les `node_modules`.

2.  **Stage `builder`** :
    - `COPY --from=deps /node_modules`.
    - `COPY . .` (Code Source).
    - `RUN npm run build`.
    - But : Compiler le TSX en JS statique et optimisé.

3.  **Stage `runner`** (Image finale) :
    - `FROM node:18-alpine`.
    - `COPY --from=builder /app/.next/standalone`. (Mode standalone de Next.js qui embarque juste le nécessaire).
    - `COPY --from=builder /app/public`.
    - `CMD ["node", "server.js"]`.

### 5.2 Variables d'Environnement

- **`HOST_IP`** : L'adresse IP physique du serveur. Injectée dans les scripts `start.ps1` pour assurer que les conteneurs peuvent se parler via le réseau de l'hôte si besoin, ou pour l'accès externe.
- **`INTERNAL_API_URL`** : Utilisé par le `polling-service` (dans Docker) pour parler au `backend` (dans Docker). Valeur : `http://backend:3001`.
- **`NEXT_PUBLIC_API_URL`** : Utilisé par le Navigateur (Client) pour parler au `backend`. Valeur : `http://<HOST_IP>:3001`.

### 5.3 Scripts d'Exploitation

#### Gestion du Cycle de Vie (PowerShell)

- **`start.ps1`** : Lance l'application en prod (injecte les IPs).
- **`rebuild.ps1`** : Reconstruit les conteneurs (si changement code/IP).
- **`change-ip.ps1`** : Modifie l'.env et relance tout.

#### Workflow Git & Déploiement (Batch - Windows)

- **`save_to_cloud.bat`** : Wrapper pour `git add/commit/push`. Sauvegarde le code sur GitHub sans déployer.
- **`deploy_now.bat`** : Raccourci vers l'interface GitHub Actions pour déclencher manuellement le workflow `deploy.yml`.
- **`backup_db.bat`** : Copie à chaud de `hyperviseur.sqlite3` avec horodatage pour backup.

---

## 6. Sécurité

### 6.1 Modèle RBAC

Les rôles sont hiérarchiques de facto :

- **`member`** : Read-Only (Voir les graphes, status).
- **`admin`** : Control (Envoyer des ordres Couple/Decouple, Acquitter alarmes).
- **`superadmin`** : System (Créer des Users, Changer les configs Modbus, Voir logs d'audit).

### 6.2 Sécurisation Inter-Services

Le `polling-service` ne possède pas de User/Password. Il utilise un **Secret Partagé** (`POLLING_SERVICE_TOKEN`).

- Ce token est généré dans `.env`.
- Le Backend vérifie `req.headers['x-service-token']`.
- Si valide -> Accès `superadmin` immédiat.
- C'est une méthode simple et efficace pour les architectures fermées (LAN/Docker).

---

## 7. Module Rapports & Analyses

Module ajouté pour fournir des KPIs, analyses et détection d'anomalies comportementales.

### 7.1 Architecture du Module

**Backend** : `backend/routes/reports.js`

- **Endpoints** :
  - `GET /api/reports/dashboard` : KPIs synthétiques (Disponibilité, Production 30j, Incidents actifs, Interventions 24h).
  - `GET /api/reports/analysis` : Analyses détaillées avec dé-doublonnage et détection de patterns.
    - _Query Params_ :
      - `start`, `end` : Bornes temporelles (ISO String).
      - `group_by` : Optionnel. Si `month`, agrège la production par mois.

**Frontend** : `src/app/reports/page.tsx` + 8 composants graphiques.

- **Fonctionnalités** :
  - **Sélecteur de Période** : "30 derniers jours" (Défaut) ou "Cette année" (Vue Mensuelle).
  - Bascule dynamiquement les appels API et le formatage des axes (Jours vs Mois).

### 7.2 Logique de Dé-doublonnage des Interventions

**Problème** : Un opérateur qui clique 10 fois sur "Coupler" en 2 minutes ne doit compter que comme **1 intervention**.

**Solution** : Fenêtre glissante de 5 minutes.

```javascript
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min
let lastLog = {}; // Clé: username-targetId-command

logs.forEach((log) => {
  const key = `${log.username}-${log.target_id}-${details.command}`;
  const logTime = new Date(log.created_at).getTime();

  if (lastLog[key] && logTime - lastLog[key].time < DEDUP_WINDOW_MS) {
    return; // Spam -> Ignorer
  }

  lastLog[key] = { time: logTime };
  // Compter comme intervention valide
});
```

### 7.3 Algorithmes de Détection d'Anomalies

Le module implémente 3 détecteurs de patterns comportementaux :

#### A. Acharnement (Hammering)

**Définition** : > 5 commandes identiques sur le même relais en < 30 minutes.

**Logique** :

1. Grouper les logs par `username + relay_id + timeSlot` (slots de 30min).
2. Compter les occurrences.
3. Si `count > 5` : Créer une alerte `HAMMERING` (Sévérité : Medium).

**Utilité** : Identifier les opérateurs qui "spamment" inutilement.

#### B. Court-Cycle (Yo-Yo)

**Définition** : Recouplage suivi d'une disjonction en < 5 minutes.

**Logique** :

1. Filtrer les logs de type `couple`.
2. Pour chaque commande, chercher un défaut (`relay_faults`) créé sur le même relais dans les 5 minutes suivantes.
3. Si trouvé : Créer une alerte `SHORT_CYCLE` (Sévérité : **Critical**).

**Utilité** : Détecte les problèmes matériels graves (court-circuit persistant, défaut d'isolement). **Arrêt des tentatives recommandé**.

```javascript
coupleLogs.forEach(log => {
    const logTime = new Date(log.created_at).getTime();
    const subsequentFault = rawFaults.find(f => {
        const fTime = new Date(f.created_at).getTime();
        return f.relay_id == log.target_id &&
               fTime > logTime &&
               (fTime - logTime) < (5 * 60 * 1000);
    });

    if (subsequentFault) {
        patterns.push({ type: 'SHORT_CYCLE', severity: 'critical', ... });
    }
});
```

#### C. Récurrence (Daily Pattern)

**Définition** : Même relais, même heure (+/- 30min), > 2 jours différents.

**Logique** :

1. Grouper les défauts par `relay_id + hour`.
2. Compter le nombre de jours distincts.
3. Si `days.size > 2` : Créer une alerte `RECURRING` (Sévérité : Warning).

**Utilité** : Identifier les problèmes structurels (ombre portée, timer externe, surtension réseau récurrente).

```javascript
const recurringGroup = {};
rawFaults.forEach(f => {
    const date = new Date(f.created_at);
    const day = date.toDateString();
    const hour = date.getHours();
    const key = `${f.relay_id}-${hour}`;

    if (!recurringGroup[key]) recurringGroup[key] = { days: new Set(), ... };
    recurringGroup[key].days.add(day);
});

Object.values(recurringGroup).forEach(group => {
    if (group.days.size > 2) {
        patterns.push({ type: 'RECURRING', severity: 'warning', ... });
    }
});
```

### 7.4 Composants Frontend

**Graphiques Principaux** :

- `DashboardCards.tsx` : 4 KPIs (Disponibilité, Production, Incidents, Interventions).
- `TopProducersChart.tsx` : Classement des centrales (Bar Chart horizontal).
- `ResolutionStatsChart.tsx` : Efficacité téléconduite (Pie Chart : Succès vs Échec).
- `IncidentsPieChart.tsx` : Types de défauts (Bar Chart, Top 5 + "Autres").
- `ProductionPRChart.tsx` : Tendance de production (Area Chart).
- `DecouplingList.tsx` : Centrales critiques (Liste avec badges).
- `InterventionTable.tsx` : Leaderboard opérateurs (Table avec efficacité calculée).
- `IneffectiveInterventions.tsx` : Carte d'alertes pour patterns détectés.

**Internationalisation** : Tous les composants utilisent `useLanguage()` + `t()` pour supporter EN/FR/IT.

---

## 8. Algorithmes Clés Détaillés

Cette section documente la logique "métier" complexe implémentée dans le backend et le frontend.

### 8.1 Algorithme d'Historisation "Robuste"

**Fichier** : `backend/polling-service.js` (fonction `runPollingCycle`)

**Problème** : Les minuteurs JavaScript (`setInterval`) se réinitialisent au redémarrage du processus. Cela crée des "trous" de données (gaps) si le serveur redémarre à 10:09 alors que la prochaine sauvegarde était prévue à 10:10.
**Solution** : Utiliser la Base de Données comme "Source de Vérité" pour le temporel.

**Pseudo-Code :**

```javascript
Au Démarrage (StartService) :
   Pour chaque Centrale C :
      LastSavedTime = SELECT MAX(timestamp) FROM measurements WHERE plant_id = C.id
      CacheMemoire[C.id] = LastSavedTime

Dans la Boucle (runPollingCycle, toutes les 60s) :
   Pour chaque Centrale C :
      Now = Date.now()
      Delta = Now - CacheMemoire[C.id]

      SI Delta >= 10 minutes ALORS :
         Sauvegarder_Mesures(C)
         CacheMemoire[C.id] = Now
         Log("Sauvegarde effectuée")
      SINON :
         Ne rien faire (Juste update temps réel)
```

**Résultat** : Même si le conteneur redémarre 50 fois, il ne sauvegardera jamais de doublons et "rattrapera" le point manquant dès le démarrage si le délai est dépassé.

### 8.2 Parsing Big Endian / Word Swap (Modbus)

**Fichier** : `backend/polling-service.js` (fonctions `parseSwappedLong`)

**Problème** : Le standard Modbus définit des registres de 16 bits. Pour stocker un entier 32 bits (ex: 123456), il faut 2 registres. L'ordre des octets n'est pas standardisé.
**Cas Thytronic XMR-A** : Mélange les formats.

- **Courants** : Big Endian (Standard). `[High Word] [Low Word]`.
- **Tensions** : Little Endian Word Order (Word Swap). `[Low Word] [High Word]`.

**Algorithme de Reconstruction (Word Swap) :**
Soit le Buffer B de 4 octets.

1. Lire les octets 0 et 1 comme un entier 16-bit (`LowWord`).
2. Lire les octets 2 et 3 comme un entier 16-bit (`HighWord`).
3. Combiner : `Valeur = (HighWord * 65536) + LowWord`.
4. Gérer le signe (Complément à 2) si nécessaire (ici non, car `Unsigned`).

```javascript
// Exemple Concret : Valeur 0x0001E240 (123456)
// Big Endian en mémoire : [00 01] [E2 40]
// Word Swap reçu        : [E2 40] [00 01]
//                        Low     High
High = 0x0001 (1)
Low  = 0xE240 (57920)
Result = 1 * 65536 + 57920 = 123456. Correct.
```

### 8.3 Détection des Défauts par Masque de Bits

**Fichier** : `backend/fault-service.js`

**Problème** : Le relais renvoie un seul entier (ex: `1025`) représentant tous les défauts actifs.
**Algorithme** :
Le registre est un **Bitmask**. Chaque bit correspond à un code ANSI (ex: 50/51 surintensité).

1. Lire le registre d'état (ex: Reg 100).
2. Pour chaque définition de défaut (ex: "Bit 0 = Surintensité phase 1") :
   - Tester si `(Registre & (1 << BitIndex)) !== 0`.
   - SI `Vrai` ET `Défaut non actif en BDD` :
     - Créer une nouvelle alarme (`INSERT INTO alarms`).
     - Marquer comme `Active`.
   - SI `Faux` ET `Défaut actif en BDD` :
     - Si l'alarme était "Acquittée" : La marquer comme `Recovered` (Historisée).
     - Si l'alarme était "Non Acquittée" : La supprimer ou la marquer comme `Fugitive`.

### 8.4 Agrégation Horaire (Post-Traitement)

**Fichier** : `backend/cron/aggregator.js`

**Objectif** : Transformer des millions de lignes de mesures brutes en données rapides à lire pour les graphes annuels.
**Exécution** : Cron Job à H+5 minutes (ex: 14:05).

1. Définir l'intervalle cible : `[13:00:00, 13:59:59]`.
2. `SELECT * FROM measurements WHERE timestamp IN interval`.
3. Calculs :
   - `AvgPower = SUM(power) / count`.
   - `MaxPower = MAX(power)`.
   - `Energy = Diff(TotalEnergy_End - TotalEnergy_Start)`.
4. `INSERT INTO measurements_hourly ...`.
5. **Vacuum** : `DELETE FROM measurements WHERE timestamp < Date.now() - 30 jours`.

---

## 9. Limites actuelles et points à améliorer

Cette section liste les problèmes connus et les améliorations prévues (ou souhaitées).

### 9.1 Limites techniques

- **Polling séquentiel** : Le polling-service lit les relais un par un. Si on monte à 50+ relais, il faudra paralléliser (Pool de Workers).
- **Pas de cache Redis** : Les requêtes API refont des SELECT à chaque fois. Pour l'instant, Postgres gère bien, mais si on a beaucoup d'utilisateurs simultanés, il faudra ajouter un cache.

### 9.2 Bugs connus

- **Bug L3 Thytronic** : Certains relais renvoient une valeur saturée pour L3 (65530-70000). Workaround en place (force à 0), mais idéalement il faudrait contacter le support Thytronic pour un correctif firmware.
- **Cron agrégation** : Si le cron `aggregator.js` rate une exécution (serveur down à H+5), l'heure correspondante n'est pas agrégée. Il faudrait un script de "rattrapage" pour les heures manquantes.

### 9.3 Améliorations prévues (non prioritaires)

- **Monitoring Prometheus** : Ajouter des métriques (temps de réponse Modbus, nombre d'erreurs, etc.) pour surveiller la santé du système.
- **Tests automatisés** : Pour l'instant, on teste manuellement sur site. Il faudrait des tests unitaires pour les fonctions de parsing Modbus.
- **Interface admin améliorée** : L'éditeur de device models fonctionne, mais l'UX pourrait être améliorée (validation en temps réel, prévisualisation des adresses, etc.).

### 9.4 Dettes techniques

- **Gestion d'erreurs** : Certaines routes API renvoient juste `500 Internal Server Error` sans détails. Il faudrait un système de logging structuré (Winston/Pino) avec niveaux.
- **Documentation API** : Pas de Swagger/OpenAPI. Les endpoints sont documentés ici, mais un fichier OpenAPI serait plus pratique.
- **Internationalisation** : Le frontend supporte EN/FR/IT, mais certains messages d'erreur backend sont encore en anglais uniquement.

---

_Fin du Manuel de Référence._  
_Dernière révision : Décembre 2025_
