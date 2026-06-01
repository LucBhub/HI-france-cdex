# Validation terrain — Mottalciata (comparatif)

**Date** : 2025-01-18  
**Qui** : Luc  
**Objectif** : valider qu'on ne s'est pas "auto-convaincus" sur un seul site (Codroipo), et que ça tient aussi ailleurs.

## Contexte rapide

- **Site** : Mottalciata (IT)
- **Relais** : Thytronic XMR-A
- **IP/Port/UnitId** : 10.16.0.31:502 / unit 1 (à confirmer)
- **Conditions** : nuageux, production variable (30–60% nominal)

## Ce qu’on a regardé (sans surpromettre)

### 1) Mesures temps réel (sanity check)

| Mesure        | Valeur convertie | Attendu     | Notes |
| ------------- | ---------------- | ----------- | ----- |
| P active      | 850 kW           | ~800–900 kW | OK    |
| Tension moy.  | 395 V            | ~400 V      | OK    |
| Courant total | 110 A            | ~100–120 A  | OK    |
| Fréquence     | 50.02 Hz         | 50 Hz       | OK    |

**À noter** : sur ce relais-là, on n’a **pas** vu le bug L3 “saturé” (contrairement à Codroipo).
Ça renforce l’idée que c’est “relay/firmware-specific”, pas un bug général de notre parsing.

### 2) Alarmes (détection + cycle de vie)

| Cas                                  | Résultat     | Temps    | Notes |
| ------------------------------------ | ------------ | -------- | ----- |
| Défaut surintensité (simulé/observé) | alarme créée | ~3 s     | OK    |
| Acquittement                         | OK           | immédiat | OK    |
| Récupération                         | OK           | ~5 s     | OK    |

### 3) Perf (juste pour sentir si ça rame)

- Polling cycle : ~45s pour 3 relais → OK pour l’instant
- Latence réseau : <100ms (mesure “grossière”)

## Différences vs Codroipo

- ici pas de L3 saturée (à garder en tête si un jour ça apparaît)
- sinon comportement global similaire

## Conclusion (honnête)

Rien d’inquiétant sur Mottalciata.
À garder en TODO : refaire une passe “météo différente” (plein soleil) pour comparer la conversion puissance sur une journée complète.
