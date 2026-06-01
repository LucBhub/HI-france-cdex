# Hyperviseur HI²

Modern solar plant monitoring solution built with Next.js, Node.js, and PostgreSQL.

## Architecture

The project is dockerized and consists of the following services:

- **Frontend**: Next.js application (Port 3000)
- **Backend**: Node.js/Express API (Port 3001 public HTTPS / Port 3002 internal HTTP)
- **Database**: PostgreSQL 15 (Port 5433 on host, 5432 internal)
- **Polling Service**: Dedicated service for Modbus data acquisition
- **Backup Service**: Automated daily database backups
- **MQTT Sandbox**: Mosquitto broker for dry-run command tests (Port 1883)
- **MQTT Simulator**: Node.js service that receives sandbox commands and publishes ACKs

## Ignition France migration sandbox

This branch includes the first migration foundation for the France Ignition hypervisor:

- Architecture tables for sites, postes, cellules, equipements and onduleurs.
- A versioned Ignition command catalog in `backend/data/ignition-command-catalog.json`.
- A versioned Ignition architecture metadata file in `backend/data/ignition-architecture-export.json` with a safe metadata-only import.
- A dry-run `command_service` exposed through `/api/commands`.
- Command run observability with summaries and timelines on `/api/commands/runs/:id/status`.
- Legacy relay command wrappers that stay in dry-run while `COMMAND_LIVE_ENABLED=false`.
- A local Mosquitto sandbox and MQTT simulator.

Read the operational guide before testing commands:

- `docs/SANDBOX_DRY_RUN.md`
- `docs/IGNITION_COMMAND_MATRIX.md`
- `docs/IGNITION_ARCHITECTURE_IMPORT.md`
- `docs/IGNITION_PARITY_AUDIT.md`

Important safety default:

```env
COMMAND_MODE=dry_run
COMMAND_LIVE_ENABLED=false
COMMAND_DRY_RUN_PUBLISH=true
MQTT_URL=mqtt://mqtt-broker:1883
```

To start only the sandbox foundation:

```bash
docker compose --env-file .env.example up -d postgres mqtt-broker backend mqtt-simulator
```

For local overrides, copy `.env.example` to `.env` and run Compose with:

```bash
docker compose --env-file .env up -d postgres mqtt-broker backend mqtt-simulator
```

The command runtime has a code-level dry-run kill switch in this lot: command APIs and legacy relay wrappers do not execute live Modbus commands even if `COMMAND_LIVE_ENABLED=true` is set by mistake. `/health` exposes the public command runtime status so this can be checked quickly.

CI validates npm audit, backend tests, frontend typecheck/build, Compose configuration and a current-tree secret scan on `main` and `codex/**` branches.

The Ignition architecture ZIP is not a database dump. The sandbox records the extracted mapping as `metadata_only` and continues to backfill only known sites from `plants` until real `Architecture/Create_Tag` rows are supplied.

## Environnements

Le projet est structuré autour de trois environnements distincts :

### 1. Développement Local (Pure Node - SUR HÔTE)

- **Usage** : Développement rapide avec Hot-Reload, debug pas à pas dans VS Code.
- **Configuration** : Créer un fichier `.env.local` à la racine :
  ```env
  PORT=3003
  INTERNAL_PORT=3004
  INTERNAL_API_URL=http://localhost:3004
  DB_HOST=localhost
  DB_PORT=5433
  ```
- **Lancement** :
  1.  Démarrer uniquement la DB : `docker-compose up -d postgres`
  2.  Lancer le Backend : `cd backend; npm run dev` (Port 3003/3004)
  3.  Lancer le Frontend : `npm run dev` (Port 3000)

### 2. Développement Local (Docker Compose)

- **Usage** : Test de l'application complète dans des containers isolés.
- **Lancement** : `.\start.bat` (Windows) ou `docker-compose up -d --build`.
- **Accès** : `https://localhost:3000`.

### 3. Preproduction Locale (Helm / Kubernetes)

- **Usage** : Validation du déploiement Kubernetes et des configurations Helm avant mise en prod.
- **Structure** : Orchestré par les charts Helm dans `./hi2-helm`.
- **Lancement (Recommandé)** : `.\rebuild-preprod-local.bat` (Build les images + Upgrade Helm + Restart Pods).
- **Lancement (Manuel)** : `helm upgrade --install hyperviseur-local ./hi2-helm -f ./hi2-helm/values-local.yaml`.
- **Architecture** : Utilise les images locales `hyperviseur-backend:local` et `hyperviseur-frontend:local`.
- **Accès (Redirections de ports)** :
  - **Automatique (Recommandé)** : Lancez `.\start-preprod-forward.bat`.
  - **Manuel** :

  ```bash
  # Frontend (Access via http://localhost:8081)
  kubectl port-forward svc/hyperviseur-local-hi2-helm-frontend 8081:3000

  # Backend API (Access via http://localhost:8082)
  kubectl port-forward svc/hyperviseur-local-hi2-helm-backend 8082:3001

  # Base de Données (Access via localhost:5434)
  kubectl port-forward svc/hyperviseur-local-hi2-helm-postgres 5434:5432
  ```

- **Base de Données** : Postgres déployé dans le cluster.

### 3. Production (Serveur Distant)

- **Usage** : Environnement client final.
- **Déploiement** : Automatisé via GitHub Actions (`deploy.yml`).
- **Mise à jour** : Utilisation de `deploy_now.bat` pour déclencher le déploiement sur la VM distante.
- **URL** : `https://hi2.host.reden.cloud`.

## Prerequisites

- Docker Desktop & Docker Compose
- Node.js 20+ (for local development)

## Getting Started

1.  **Clone the repository**
2.  **Configure Environment**:
    - Copy `.env.example` to `.env`.
    - **Solar Irradiation**: Uses Open-Meteo (No key required).
    - **Map Layers**: Add `NEXT_PUBLIC_OPENWEATHER_API_KEY` (from OpenWeatherMap) to enable clouds/temp layers.
    - **Azure AD Auth**: Add `FRONTEND_BASE_URL` in `.env` (or docker-compose) so the backend knows where to redirect users safely after Microsoft Login login.
3.  **Start Services**:
    ```bash
    docker-compose up -d --build
    ```
4.  **Access Application**:
    - Frontend: `https://localhost:3000`
    - Backend API: `https://localhost:3001`

## Database & Backups

We use PostgreSQL as the primary data store.

- **Persistence**: Data is stored in the `postgres_data` Docker volume.
- **Backups**:
  - Automated: Runs daily at 24h intervals.
  - Manual: `docker exec hyperviseur-backup backup.sh`
- **Restoration**:
  - `docker exec hyperviseur-backup restore.sh <filename>` (files located in `./backups`)

## Development

- **Migrations**: Managed via Knex.js.
  - Run `knex migrate:latest` in `backend/` to update schema.
  - Migrations run automatically on container startup.
