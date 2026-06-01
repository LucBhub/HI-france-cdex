# 🚀 Guide de Déploiement et Environnements

Ce document décrit les trois environnements du projet Hyperviseur et les procédures pour les déployer et les maintenir.

---

## 1. Environnement de Développement (Local)

**Objectif :** Développement rapide, modification de code en temps réel (Hot Reload), tests fonctionnels basiques.

- **Technologie :** Docker Compose (`docker-compose.yml`)
- **Fichier de configuration :** `.env` (racine)
- **URLs :**
  - Frontend : `https://localhost:3000`
  - Backend : `https://localhost:3001`

### 🛠️ Comment lancer ?

Double-cliquez sur :

> **`start.bat`**

Ce script :

1.  Détecte votre IP locale.
2.  Génère les certificats SSL locaux (si absents).
3.  Lance les conteneurs (Frontend, Backend, Postgres, Polling).

### 🔄 Cycle de vie

- Le code est monté en **volume** : toute modification dans `src/` ou `backend/` est immédiatement visible (HMR).
- **Arrêt :** `docker-compose down` ou via Docker Desktop.

---

## 2. Environnement de Pré-Production (Local Kubernetes)

**Objectif :** Valider le packaging Docker, les charts Helm, les sondes (Probes), et la configuration réseau Kubernetes avant la prod.

- **Technologie :** Kubernetes (Docker Desktop ou Minikube) + Helm
- **Fichiers de configuration :**
  - Chart : `hi2-helm/`
  - Valeurs : `hi2-helm/values-local.yaml` (Surcharge les valeurs de prod pour le local)
- **URLs :**
  - Frontend : `http://localhost:8081` (via Port-Forward)

### 🛠️ Comment déployer ?

Pour construire les images, mettre à jour le Chart Helm et redémarrer les pods, lancez :

> **`rebuild-preprod-local.bat`**

### 🔌 Comment accéder ?

Une fois déployé, pour accéder à l'interface (car pas d'Ingress/Domaine réel en local) :

> **`start-preprod-forward.bat`**

### 💡 Spécificités Techniques

- **Probes :** Utilisent `tcpSocket` pour être compatibles HTTP/HTTPS.
- **CORS :** Le backend autorise `http://localhost:8081`.
- **Runtime Config :** Le frontend utilise `server.js` pour lire `INTERNAL_API_URL` au démarrage du pod.

---

## 3. Environnement de Production (Cluster Remote)

**Objectif :** Environnement réel, stable, sécurisé et performant.

- **Technologie :** Cluster Kubernetes (Managé) + Ingress Controller (Traefik/Nginx)
- **Fichiers de configuration :**
  - Chart : `hi2-helm/`
  - Valeurs : `hi2-helm/values.yaml`
- **URL :** `https://hi2.host.reden.cloud`

### 🚀 Procédure de Déploiement (Recommandée via CI/CD)

**1. Build des Images Docker**
⚠️ **CRITIQUE :** L'argument `NEXT_PUBLIC_API_URL` doit être l'URL publique de prod.

```bash
# Frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://hi2.host.reden.cloud \
  --build-arg NEXT_PUBLIC_OPENWEATHER_API_KEY=$NEXT_PUBLIC_OPENWEATHER_API_KEY \
  -t registry.hyxo.ovh/reden/hi2:frontend-prod-v1 \
  .


# Backend
docker build \
  -t registry.hyxo.ovh/reden/hi2:backend-prod-v1 \
  ./backend
```

**2. Push vers Registry**

```bash
docker push registry.hyxo.ovh/reden/hi2:frontend-prod-v1
docker push registry.hyxo.ovh/reden/hi2:backend-prod-v1
```

**3. Déploiement Helm**

```bash
helm upgrade --install hyperviseur ./hi2-helm \
  --set frontend.image.tag=frontend-prod-v1 \
  --set backend.image.tag=backend-prod-v1 \
  --values ./hi2-helm/values.yaml
```

### ✅ Checklist Avant Mise en Prod

- [ ] **Secrets :** `jwtSecret`, `dbPass`, `azureClientSecret` sont-ils définis dans le cluster (Secret K8s) ?
- [ ] **Certificats :** Cert-Manager a-t-il généré le secret `hyperviseur-tls` ?
- [ ] **Base de Données :** La migration (`initDb`) s'est-elle bien passée au démarrage du backend ?

---

## 🚑 Dépannage (Troubleshooting)

| Symptôme                              | Cause Probable                         | Solution                                                                     |
| :------------------------------------ | :------------------------------------- | :--------------------------------------------------------------------------- |
| **Erreur 500 au Login**               | CORS ou URL API incorrecte             | Vérifier `CORS_ORIGINS` dans `values.yaml` et `INTERNAL_API_URL`.            |
| **Pod Frontend ne passe pas "Ready"** | Probe HTTP sur port HTTPS (ou inverse) | Vérifier `deployment-frontend.yaml`. Utiliser `tcpSocket` est le plus sûr.   |
| **Page blanche / Erreur JS**          | Mauvaise URL API publique              | Vérifier que l'image a été buildée avec le bon `NEXT_PUBLIC_API_URL`.        |
| **Connexion DB refusée**              | Mot de passe incorrect                 | Vérifier les Secrets K8s (`kubectl get secret hyperviseur-secrets -o yaml`). |
