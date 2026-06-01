# ADR-0003 — Thytronic XMR-A: l’endianness “mixte” (et la galère qui va avec)

**Date** : 2025-01 (après tests terrain)  
**Auteur** : Luc  
**Statut** : Accepté (à revalider si firmware change)

## Ce qui s’est passé (le vrai contexte)

On a eu des valeurs de tension **complètement absurdes** au début (du style 45kV au lieu d’environ 400V côté mesure convertie).

Après pas mal de tests + lecture du manuel Thytronic (section pas très visible…), on a compris que :

- certaines valeurs sont en Big Endian “classique”
- d’autres sont en **Word Swap** (ordre des mots 16-bit inversé)

En gros, sur Thytronic:

- **courants**: plutôt “standard”
- **tensions** et parfois **fréquence**: Word Swap

## Ce qu’on a essayé (et ce qui n’a pas marché)

- tout forcer en Big Endian → tensions incohérentes
- “auto-détection” (heuristique) → trop risqué: tu peux “tomber juste” par hasard et te faire piéger en prod

## Décision (simple mais robuste)

On a choisi d’être **explicites** dans le `device_model`:

- chaque bloc de mesure précise son `type` (`long`, `ulong`, `long_swap`, etc.)
- le `polling-service.js` parse en conséquence (`parseLong`, `parseSwappedLong`, …)

Pourquoi comme ça ?

- parce que c’est lisible
- parce qu’on peut ajouter un nouveau matériel sans toucher au code (en théorie)
- parce qu’en debug, tu vois “tout de suite” quel type a été choisi

## Ce que ça implique

**+** On ne dépend pas d’une magie “auto” → moins de surprises  
**-** On peut se tromper dans la config → il faut valider sur site / avec scripts

## Comment on a validé (à garder en tête)

Scripts utiles côté `backend/` :

- `test_voltage_swapped.js` (valide le swap)
- scripts `fix-thytronic-*.js` (corrige la config DB quand on s’est trompés d’adresse/Kv)

## Notes / TODO

- TODO: garder une trace du firmware Thytronic (version) sur les sites où on a vu ce comportement.
- TODO: si un site sort des valeurs “bizarres”, vérifier d’abord endianness + Kv avant de conclure à un problème électrique.
