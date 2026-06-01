# 1. Installer les dépendances
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# 2. Construire l'application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Créer un dossier public vide s'il n'existe pas, pour éviter l'erreur de build
RUN mkdir -p public
# Variable d'environnement pour la construction
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RELAY_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_RELAY_API_URL=$NEXT_PUBLIC_RELAY_API_URL
ARG NEXT_PUBLIC_OPENWEATHER_API_KEY=
ENV NEXT_PUBLIC_OPENWEATHER_API_KEY=$NEXT_PUBLIC_OPENWEATHER_API_KEY
# INTERNAL_API_URL for server-side API calls (rewrites)
ARG INTERNAL_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN npm run build

# 3. Exécuter l'application
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copier les fichiers de build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
# Copy server file and certs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY certs ./certs
# Copy public folder (even if empty)
COPY --from=builder /app/public ./public
# Copy Next.js config
COPY --from=builder /app/next.config.ts ./next.config.ts

# Runtime environment variable for API proxy
ENV INTERNAL_API_URL=http://backend:3002

EXPOSE 3000
CMD ["npm", "start"]
