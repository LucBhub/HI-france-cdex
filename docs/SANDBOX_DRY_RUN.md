# Sandbox dry-run commandes

Date: 2026-06-01

Ce document decrit le socle ajoute pour reconstruire les commandes Ignition France sans toucher aux centrales.

## Objectif

Le sandbox permet de tester le parcours complet suivant:

1. Appel API `POST /api/commands`.
2. Validation de la commande dans `command_catalog`.
3. Creation d'un run dans `command_runs`.
4. Publication MQTT vers un broker local sandbox.
5. Reception par `mqtt-simulator`.
6. Journalisation dans `sandbox_mqtt_events` et `audit_logs`.
7. Reception eventuelle d'un ACK simulateur sur `sandbox/acks`.

Par defaut, aucune commande live n'est possible.

## Services Docker

Services ajoutes:

- `mqtt-broker`: broker Mosquitto local, port `1883`.
- `mqtt-simulator`: service Node.js qui souscrit a `#`, ignore `sandbox/#`, log les messages et publie un ACK sur `sandbox/acks`.

Variables par defaut:

```env
MQTT_URL=mqtt://mqtt-broker:1883
COMMAND_MODE=dry_run
COMMAND_LIVE_ENABLED=false
COMMAND_DRY_RUN_PUBLISH=true
```

Le fichier `.env.example` est versionne et permet de valider un clone propre sans secret reel:

```powershell
docker compose --env-file .env.example config
```

Pour des overrides locaux, copier `.env.example` vers `.env`, modifier les valeurs locales, puis lancer Compose avec:

```powershell
docker compose --env-file .env up -d postgres mqtt-broker backend mqtt-simulator
```

Si une autre stack locale utilise deja les noms ou ports `hyperviseur-*`, changer `HYPERVISEUR_CONTAINER_PREFIX`, `BACKEND_HTTPS_PORT`, `BACKEND_INTERNAL_PORT`, `POSTGRES_HOST_PORT` et `MQTT_HOST_PORT`.

## Demarrage local

Pour demarrer uniquement le socle sandbox:

```powershell
docker compose --env-file .env.example up -d postgres mqtt-broker backend mqtt-simulator
```

Pour verifier la configuration Compose sans demarrer:

```powershell
docker compose --env-file .env.example config
```

Pour suivre le simulateur:

```powershell
docker logs -f hyperviseur-mqtt-simulator
```

Healthchecks Docker:

- `postgres`: `pg_isready`.
- `mqtt-broker`: abonnement local au topic `$SYS/broker/version`.
- `backend`: appel HTTP interne `http://127.0.0.1:3002/health`.

Le backend et le simulateur MQTT attendent maintenant Postgres et Mosquitto en etat healthy avant de demarrer.

Verification runtime:

```powershell
curl.exe http://localhost:3002/health
```

La reponse contient `runtime.commands.liveEnabled=false` et `runtime.commands.liveKillSwitch=true`.

## Endpoints API

Toutes les routes necessitent un JWT avec un role existant: `member`, `admin` ou `superadmin`.

Commandes:

- `GET /api/commands/catalog`
- `GET /api/commands/runs`
- `GET /api/commands/runs/:id`
- `POST /api/commands`

Architecture:

- `GET /api/architecture/sites`
- `GET /api/architecture/sites/:id/tree`

Wrappers legacy relais:

- `POST /api/plants/:plantId/relays/:relayId/control`
- `POST /api/plants/:plantId/relays/control-all`

Dans ce lot, ces wrappers ne touchent pas Modbus et passent par le `command_service` en dry-run, meme si `COMMAND_LIVE_ENABLED=true` est defini par erreur.

## Exemple de commande dry-run

Exemple direct via l'API commandes:

```powershell
curl.exe -k -X POST https://localhost:3001/api/commands `
  -H "Authorization: Bearer <TOKEN>" `
  -H "Content-Type: application/json" `
  --data "{\"commandKey\":\"legacy.relay.couple\",\"target\":{\"plantId\":1,\"relayId\":2},\"params\":{},\"mode\":\"dry_run\"}"
```

Exemple via wrapper legacy:

```powershell
curl.exe -k -X POST https://localhost:3001/api/plants/1/relays/2/control `
  -H "Authorization: Bearer <TOKEN>" `
  -H "Content-Type: application/json" `
  --data "{\"command\":\"couple\"}"
```

Reponse attendue:

```json
{
  "success": true,
  "dryRun": true,
  "runId": 1,
  "status": "dry_run_published",
  "plannedEvents": [
    {
      "transport": "mqtt",
      "topic": "legacy/plants/1/relays/2/control/couple",
      "payload": "true"
    }
  ]
}
```

Le simulateur conserve le payload reel recu, cherche un evenement outbound recent avec le meme `topic` et `payload`, puis rattache l'ACK au `command_run_id` quand la correspondance est trouvee. L'API ne bloque pas en attente de cet ACK: elle repond des que la publication dry-run est planifiee/publiee.

## Tables creees

Architecture:

- `architecture_sites`
- `architecture_postes`
- `architecture_cellules`
- `architecture_equipements`
- `architecture_onduleurs`
- `architecture_imports`

Commandes:

- `command_catalog`
- `command_runs`
- `sandbox_mqtt_events`

Le backfill initial remplit seulement `architecture_sites` depuis `plants`. Aucun poste, cellule, equipement ou onduleur n'est invente.

## Catalogue de commandes

Source versionnee:

- `backend/data/ignition-command-catalog.json`

Commandes initiales:

- `cell.open`
- `cell.close`
- `deie.authorize_coupling`
- `deie.request_decoupling`
- `deie.request_urgent_decoupling`
- `synoptic.acknowledge`
- `ptr.charger_restart`
- `inverter.stop_start`
- `inverter.stop_start_all`
- `aggregator.stop_general`
- `aggregator.set_rapidite`
- `aggregator.set_stop_delay`
- `legacy.relay.couple`
- `legacy.relay.decouple`
- `legacy.relay.reset`

Toutes les commandes sont importees avec:

- `live_enabled=false`
- `validation_status=inferred`
- `source=ignition_export`

## Regles de securite v1

- Tous les utilisateurs authentifies peuvent tester en simulation.
- Le live est bloque par defaut avec `COMMAND_LIVE_ENABLED=false`.
- Le live reste bloque par un kill switch code-level dans ce lot, meme si `COMMAND_LIVE_ENABLED=true` est defini par erreur.
- L'API `/api/commands` refuse tout `mode` different de `dry_run`.
- Les anciens endpoints relais ne touchent plus Modbus dans ce lot et passent par le `command_service` en dry-run.
- Le broker Mosquitto ajoute ici est un sandbox local sans bridge production.

## Tests

Depuis `backend/`:

```powershell
npm test -- --runInBand
```

Couverture ajoutee:

- migrations architecture/commandes.
- seed idempotent du catalogue.
- validation API commandes.
- journalisation dry-run.
- parsing runtime fail-closed.
- erreur broker indisponible.
- wrappers relais sans Modbus.
- correlation ACK simulateur.

Checks locaux recommandes avant push:

```powershell
cd backend; npm test -- --runInBand
cd ..; npm run typecheck
npm run build
docker compose --env-file .env.example config
```
