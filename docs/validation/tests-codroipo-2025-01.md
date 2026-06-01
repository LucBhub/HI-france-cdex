# Validation terrain — Codroipo (Thytronic XMR-A)

**Date** : 2025-01-15  
**Qui** : Luc  
**Objectif** : vérifier que les lectures Modbus + conversions + téléconduite tiennent la route sur site réel (pas en "lab").

## Contexte rapide

- **Site** : Codroipo (IT)
- **Relais** : Thytronic XMR-A
- **IP/Port/UnitId** : 10.16.0.30:502 / unit 1 (à confirmer)
- **Conditions** : ciel dégagé, production “normale” (~80% nominal)

## Outils / commandes utilisées (pour qu’on puisse refaire)

- Lecture brute registres (si besoin) :
  - `node backend/check_registers.js <IP> <StartAddr> <Count>`
- Tests endianness tensions :
  - `node backend/test_voltage_swapped.js`
- Vérifs config modèle en base (si on suspecte une adresse/Kv faux) :
  - `node backend/dump_models.js` (si présent/utile)

## 1) Nominales (Inp/Unp → Pn)

On a vérifié que les nominales sont cohérentes, parce que derrière ça conditionne les conversions.

| Paramètre   | Attendu   | Lu    | Notes |
| ----------- | --------- | ----- | ----- |
| Inp         | ~100 A    | 100   | OK    |
| Unp         | ~20000 V  | 20000 | OK    |
| Pn (calcul) | ~3464 kVA | 3464  | OK    |

## 2) Mesures temps réel (courants / tensions)

| Mesure | Brut     | Converti | Attendu  | Notes                    |
| ------ | -------- | -------- | -------- | ------------------------ |
| I1     | 57920    | 36.2 A   | ~35–40 A | OK                       |
| I2     | 58240    | 36.4 A   | ~35–40 A | OK                       |
| I3     | 58560    | 36.6 A   | ~35–40 A | OK                       |
| V1     | 11200000 | 400 V    | ~400 V   | OK                       |
| V2     | 11200000 | 400 V    | ~400 V   | OK                       |
| V3     | 65535    | 0 V      | ~400 V   | PAS OK (voir ci-dessous) |

### Note “pas fun” (bug L3)

Sur ce relais, on a vu plusieurs fois une valeur “saturée” sur L3 (entre 65530 et 70000).
Ça ressemble à un bug firmware Thytronic (ou un truc du même genre), pas à un vrai 0V.

**Workaround** : dans `backend/polling-service.js`, on force L3 à 0 quand on détecte cette plage de valeurs,
sinon les graphes partent en pic et on se fait spammer par des faux signaux.

À surveiller :

- est-ce que ça arrive sur tous les relais du site ou juste celui-là ?
- fréquence (1 fois/jour ? 1 fois/heure ?)

## 3) Téléconduite (couple / découple)

On a testé en conditions réelles (avec prudence). Temps à la louche :

| Action     | Résultat | Latence | Notes         |
| ---------- | -------- | ------- | ------------- |
| Découplage | OK       | ~2–3 s  | état confirmé |
| Recouplage | OK       | ~2 s    | état confirmé |

## 4) Historisation (anti-trous / anti-doublons)

On a vérifié que l’historisation ne fait pas n’importe quoi au redémarrage :

- points toutes les **10 minutes**
- pas de doublons après restart conteneur

Exemples vus (à compléter si on a les logs) :

- 14:00 / 14:10 / 14:20 présents → OK

## Problèmes rencontrés / actions

1. **L3 saturée** → workaround dans `polling-service.js`
2. **Puissances** : on s’est déjà trompés d’adresse au début (IDX vs 0-based) → corrigé (479 → 478)

## Conclusion (honnête)

Globalement OK sur Codroipo, **sauf** le sujet L3 à surveiller.
Si ça devient trop fréquent, il faudra envisager :

- firmware Thytronic / support
- ou au minimum logguer combien de fois/jour ça arrive (pour savoir si on masque un vrai problème).
