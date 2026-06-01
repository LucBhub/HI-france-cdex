# ADR-0001 — Pourquoi on est partis sur SQLite (et pas PostgreSQL)

**Date** : 2025-01 (début de projet)  
**Auteur** : Luc  
**Statut** : Accepté (pour le moment)

## Le contexte (version terrain)

On avait besoin d'une base de données **vite** pour :

- la config (centrales / relais / modèles Modbus)
- les mesures historisées
- les alarmes + audit (qui a envoyé quelle commande, etc.)

Contraintes au moment du choix :

- déploiement simple (Docker, VM, pas envie de gérer une infra DB complète tout de suite)
- sauvegarde facile sur site (copie/backup du fichier)
- volume raisonnable (au départ ~10–20 centrales)

## Ce qu'on a envisagé (et pourquoi on n'a pas pris)

- **PostgreSQL** : très bien, mais ça veut dire gérer un service en plus (et souvent: comptes, backup, maintenance). À ce stade on voulait éviter.
- **MySQL/MariaDB** : même problématique que PostgreSQL, pas de gain évident pour notre usage.
- **MongoDB** : on a beaucoup de relations (plants → relays → mesures → alarmes). Le relationnel colle mieux.
- **SQLite** : un fichier, pas de serveur, très bien supporté par Knex. C'était le plus “plug-and-play”.

## Décision

On part sur **SQLite** (fichier `hyperviseur.sqlite3`) avec **Knex** pour les migrations.

## Ce que ça nous a apporté (immédiat)

- déploiement ultra simple (pas de conteneur DB séparé)
- backup ultra simple (copie du fichier)
- pas de réseau DB à ouvrir/configurer

## Les limites qu'on accepte

- SQLite n'aime pas trop les écritures concurrentes → dans notre cas ça va, car **une seule chaîne** écrit vraiment (polling-service → backend → DB)
- pas de réplication native → on compense par backup régulier (script / tâche planifiée)

## “Quand est-ce qu'on changera ?” (à ne pas oublier)

On envisagera PostgreSQL si :

- on passe à **~50+ centrales** (ou cycles polling qui explosent)
- on a beaucoup plus d'utilisateurs simultanés
- on veut du reporting analytique plus lourd

## Notes / TODO

- TODO: définir une **stratégie de backup** claire côté VM (fréquence + rétention + vérif restauration).
- TODO: documenter la taille de DB “normale” après 1 mois / 6 mois (ça permettra de décider sans débat).
