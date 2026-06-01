# Guide de Déploiement Kubernetes - Hyperviseur

Ce dossier `k8s/` contient des manifests génériques pour déployer l'application Hyperviseur. Ce document est destiné à l'équipe gérant le cluster Kubernetes.

## 1. Build des Images Docker

L'application Frontend (Next.js) nécessite de connaître l'URL publique **au moment du build**.

Vous devez builder l'image frontend en passant l'argument `NEXT_PUBLIC_API_URL`.

```bash
# Exemple de build
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://votre-domaine.com \
  -t votre-registry/hyperviseur-frontend:latest \
  .
```

Si cette variable n'est pas correcte lors du build, le frontend essaiera de contacter la mauvaise API (ou localhost).

## 2. Configuration des Secrets

Le fichier `secrets-pvc.yaml` contient des placeholders.
**IMPORTANT :** Générez vos propres secrets en Base64 pour `DB_USER`, `DB_PASS`, `POLLING_SERVICE_TOKEN` ainsi que les variables d'authentification Azure (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `FRONTEND_BASE_URL`).

L'application utilise un "Cookie Exchange Pattern" sécurisé (SameSite=Lax, HttpOnly) pour transférer le token entre le Backend et le Frontend. La variable `FRONTEND_BASE_URL` est primordiale pour valider ce flux.

## 3. Configuration Ingress

Le fichier `ingress.yaml` doit être édité :

- Remplacez `YOUR_DOMAIN_HERE` par le nom de domaine final (ex: `hyperviseur.reden.solar`).
- Ajustez les annotations selon votre Ingress Controller (Nginx, Traefik, AGIC, etc.).

## 4. Déploiement

```bash
kubectl apply -f k8s/secrets-pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

## Note sur le Binding

L'application (Node.js/Next.js) est configurée pour écouter sur `0.0.0.0` à l'intérieur des conteneurs. Aucune variable d'environnement `HOST_IP` n'est nécessaire pour le **binding** serveur. Elle servait uniquement pour le développement local.
