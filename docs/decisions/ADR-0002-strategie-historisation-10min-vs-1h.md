# ADR-0002 — Historisation: pourquoi on ne stocke pas tout (et comment on s’en sort)

**Date** : 2025-01  
**Auteur** : Luc  
**Statut** : Accepté (révisable)

## Le contexte (ce qui nous a forcés à décider)

Le polling tourne “souvent” (typiquement toutes les ~60s), mais :

- stocker 1 point par minute _pour tout_ → ça gonfle vite
- et surtout ça rend les requêtes graphiques/périodes longues plus lourdes

Objectifs concrets :

- garder assez de détails pour **debugger** (pannes, trous, comportements bizarres)
- garder un historique long pour les vues **mensuelles/annuelles**
- éviter que la DB devienne un monstre

## Ce qu’on a testé / discuté

- **Tout stocker toutes les minutes** : on a vite vu que ça allait exploser (volume + lenteur).
- **Ne stocker que du horaire** : trop “grossier” quand tu veux comprendre un incident.
- **Compromis** : brutes 10 min + agrégats horaires.

## Décision (le compromis)

On fait 2 niveaux :

1. **Brut**: table `measurements`

- 1 point toutes les **10 minutes**
- rétention: **30 jours**
- sert pour les vues jour / 7j / 30j et le debug “récent”

2. **Agrégé**: table `measurements_hourly`

- 1 point **par heure** (moyenne + max, et éventuellement d’autres stats)
- rétention: **1 an** (minimum)
- sert pour les vues longues (mois/année)

## Le détail important (qui fait “terrain”)

On ne se base pas sur “un timer en mémoire” pour décider quand historiser, parce que :

- si le conteneur redémarre, tu peux créer des doublons ou des trous selon quand ça tombe

Du coup, on considère la BDD comme “source de vérité” :

- au démarrage, on regarde le dernier timestamp réellement en base
- et on historise quand \(Now - LastSaved\) dépasse 10 minutes

## Points faibles / risques (à assumer)

- si tu as un pic à 14:23, tu verras surtout 14:20 et 14:30 → c’est le prix à payer
- si le cron d’agrégation ne tourne pas à H+5 (serveur down), l’heure peut manquer

## TODO / améliorations possibles

- TODO: “rattrapage” agrégation → si une heure manque dans `measurements_hourly`, la recalculer plus tard.
- TODO: si certaines centrales sont critiques, on pourrait ajouter un mode “haute fréquence” (1 min) **uniquement** pour celles-là (et rétention courte).
