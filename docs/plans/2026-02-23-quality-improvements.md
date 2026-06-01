# Quality Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Améliorer la qualité du projet sur 5 axes : tests backend, validation des inputs, backfill agrégateur, resource limits K8s, et documentation Swagger.

**Architecture:** Backend Express.js (Node.js 20) + PostgreSQL + Knex.js. Tests avec Jest + Supertest en mockant Knex. Validation avec Zod côté backend. Swagger via swagger-jsdoc + swagger-ui-express.

**Tech Stack:** Jest, Supertest, Zod, swagger-jsdoc, swagger-ui-express, Helm values.yaml

---

## Task 1 : Setup Jest + Supertest

**Files:**

- Modify: `backend/package.json`
- Create: `backend/jest.config.js`

**Step 1: Installer les dépendances de test**

```bash
cd backend
npm install --save-dev jest supertest
```

**Step 2: Ajouter le script test dans package.json**

Dans `backend/package.json`, ajouter dans `"scripts"` :

```json
"test": "jest --testEnvironment node",
"test:watch": "jest --watch --testEnvironment node"
```

**Step 3: Créer jest.config.js**

```javascript
// backend/jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "routes/**/*.js",
    "middleware/**/*.js",
    "cron/**/*.js",
    "!**/node_modules/**",
  ],
};
```

**Step 4: Créer la structure de dossiers**

```bash
mkdir -p backend/__tests__/routes
mkdir -p backend/__tests__/middleware
mkdir -p backend/__tests__/cron
```

**Step 5: Vérifier que Jest tourne**

```bash
cd backend && npm test
```

Expected : "No test suites found" (pas d'erreur)

**Step 6: Commit**

```bash
git add backend/package.json backend/jest.config.js
git commit -m "test: setup Jest + Supertest infrastructure"
```

---

## Task 2 : Tests du middleware auth

**Files:**

- Create: `backend/__tests__/middleware/auth.test.js`
- Read: `backend/middleware/auth.js`

**Step 1: Écrire les tests**

```javascript
// backend/__tests__/middleware/auth.test.js
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test_secret_for_jest";
process.env.POLLING_SERVICE_TOKEN = "test_service_token";

const authMiddleware = require("../../middleware/auth");

function makeReq(headers = {}) {
  return { headers, ip: "127.0.0.1" };
}
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("authMiddleware", () => {
  const validToken = jwt.sign(
    { id: 1, username: "testuser", role: "admin", email: "test@test.com" },
    "test_secret_for_jest",
    { expiresIn: "1h" },
  );

  test("accepte un token JWT valide sans restriction de rôle", () => {
    const req = makeReq({ authorization: `Bearer ${validToken}` });
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe("testuser");
  });

  test("accepte un token de service valide", () => {
    const req = makeReq({ "x-service-token": "test_service_token" });
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe("polling-service");
  });

  test("rejette une requête sans token", () => {
    const req = makeReq({});
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejette un token invalide", () => {
    const req = makeReq({ authorization: "Bearer invalid_token" });
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("rejette un rôle insuffisant", () => {
    const memberToken = jwt.sign(
      { id: 2, username: "member", role: "member" },
      "test_secret_for_jest",
      { expiresIn: "1h" },
    );
    const req = makeReq({ authorization: `Bearer ${memberToken}` });
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(["admin", "superadmin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("accepte un rôle autorisé", () => {
    const req = makeReq({ authorization: `Bearer ${validToken}` });
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(["admin", "superadmin"])(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
```

**Step 2: Lancer les tests**

```bash
cd backend && npm test __tests__/middleware/auth.test.js
```

Expected : 6 tests PASS

**Step 3: Commit**

```bash
git add backend/__tests__/middleware/auth.test.js
git commit -m "test: add auth middleware unit tests"
```

---

## Task 3 : Tests des routes auth (login)

**Files:**

- Create: `backend/__tests__/routes/auth.test.js`

**Step 1: Écrire les tests**

```javascript
// backend/__tests__/routes/auth.test.js
process.env.JWT_SECRET = "test_secret_for_jest";
process.env.NODE_ENV = "test";
process.env.FRONTEND_BASE_URL = "http://localhost:3000";

// Mock knex avant d'importer la route
jest.mock("../../db/knex", () => {
  const mockKnex = jest.fn();
  mockKnex.mockReturnValue({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(),
    del: jest.fn(),
  });
  return mockKnex;
});

jest.mock("../../utils/audit-logger", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/email-service", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const bcrypt = require("bcryptjs");
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", require("../../routes/auth"));

const knex = require("../../db/knex");

describe("POST /api/auth/login", () => {
  afterEach(() => jest.clearAllMocks());

  test("retourne 400 si username ou password manquant", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "test" });
    expect(res.status).toBe(400);
  });

  test("retourne 401 si utilisateur inexistant", async () => {
    knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "pass" });
    expect(res.status).toBe(401);
  });

  test("retourne 401 si mauvais mot de passe", async () => {
    const hashed = await bcrypt.hash("correct_password", 10);
    knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 1,
        username: "test",
        password: hashed,
        role: "member",
        email: "a@b.com",
      }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "test", password: "wrong_password" });
    expect(res.status).toBe(401);
  });

  test("retourne 200 avec token si credentials corrects", async () => {
    const hashed = await bcrypt.hash("correct_password", 10);
    knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 1,
        username: "test",
        password: hashed,
        role: "admin",
        email: "a@b.com",
      }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "test", password: "correct_password" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).not.toHaveProperty("password");
  });
});

describe("POST /api/auth/forgot-password", () => {
  afterEach(() => jest.clearAllMocks());

  test("retourne 400 si email manquant", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({});
    expect(res.status).toBe(400);
  });

  test("retourne 200 même si email inexistant (pas de leak info)", async () => {
    knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@test.com" });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("retourne 400 si token ou password manquant", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "abc" });
    expect(res.status).toBe(400);
  });

  test("retourne 400 si password trop court", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "abc", password: "short" });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Lancer les tests**

```bash
cd backend && npm test __tests__/routes/auth.test.js
```

Expected : 8 tests PASS

**Step 3: Commit**

```bash
git add backend/__tests__/routes/auth.test.js
git commit -m "test: add auth routes tests (login, forgot-password, reset-password)"
```

---

## Task 4 : Tests de l'agrégateur

**Files:**

- Create: `backend/__tests__/cron/aggregator.test.js`

**Step 1: Écrire les tests**

```javascript
// backend/__tests__/cron/aggregator.test.js

// Mock knex avant l'import
const mockPlants = [{ id: 1 }, { id: 2 }];

jest.mock("../../db/knex", () => {
  const mockFns = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereBetween: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockResolvedValue([1]),
    del: jest.fn().mockResolvedValue(1),
    raw: jest.fn((sql) => sql),
  };

  const knex = jest.fn().mockReturnValue(mockFns);
  knex._mockFns = mockFns;
  return knex;
});

const knex = require("../../db/knex");
const { aggregateHourlyData, runCleanup } = require("../../cron/aggregator");

describe("aggregateHourlyData", () => {
  beforeEach(() => jest.clearAllMocks());

  test("ne fait rien si aucune plant", async () => {
    knex.mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });
    await aggregateHourlyData();
    expect(knex._mockFns.insert).not.toHaveBeenCalled();
  });

  test("saute si agrégation déjà existante", async () => {
    knex
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ id: 1 }]) })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 999 }), // existe déjà
      });

    await aggregateHourlyData();
    expect(knex._mockFns.insert).not.toHaveBeenCalled();
  });
});

describe("runCleanup", () => {
  test("tourne sans erreur", async () => {
    knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      del: jest.fn().mockResolvedValue(5),
    });

    await expect(runCleanup()).resolves.not.toThrow();
  });
});
```

**Step 2: Lancer les tests**

```bash
cd backend && npm test __tests__/cron/aggregator.test.js
```

Expected : 3 tests PASS

**Step 3: Commit**

```bash
git add backend/__tests__/cron/aggregator.test.js
git commit -m "test: add aggregator cron unit tests"
```

---

## Task 5 : Backfill de l'agrégateur

**Files:**

- Modify: `backend/cron/aggregator.js`

**Contexte:** Actuellement, si le serveur est down à H+5, l'heure est perdue. Il faut ajouter une fonction `backfillMissingHours` qui, au démarrage, vérifie les dernières 48h et agrège les heures manquantes.

**Step 1: Ajouter la fonction backfill dans aggregator.js**

À la fin de `aggregateHourlyData`, juste avant `module.exports`, ajouter :

```javascript
async function backfillMissingHours(hoursBack = 48) {
  console.log(`[Aggregator] Backfilling last ${hoursBack} hours...`);
  const now = new Date();
  let filled = 0;

  for (let i = 1; i <= hoursBack; i++) {
    const slotStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    slotStart.setMinutes(0, 0, 0);
    const startTimeStr = slotStart.toISOString();

    try {
      const plants = await knex("plants").select("id");
      for (const plant of plants) {
        const existing = await knex("measurements_hourly")
          .where({ plant_id: plant.id, timestamp: startTimeStr })
          .first();

        if (existing) continue;

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(59, 59, 999);

        const result = await knex("measurements")
          .where({ plant_id: plant.id })
          .whereBetween("timestamp", [startTimeStr, slotEnd.toISOString()])
          .groupBy("plant_id")
          .select(
            knex.raw("avg(power_kw) as avg_power"),
            knex.raw("max(power_kw) as max_power"),
            knex.raw("avg(voltage_v) as avg_voltage"),
            knex.raw("max(voltage_v) as max_voltage"),
            knex.raw("min(voltage_v) as min_voltage"),
            knex.raw("avg(current_a) as avg_current"),
            knex.raw("max(current_a) as max_current"),
          )
          .first();

        if (result) {
          await knex("measurements_hourly").insert({
            plant_id: plant.id,
            timestamp: startTimeStr,
            avg_power_kw: result.avg_power || 0,
            max_power_kw: result.max_power || 0,
            total_energy_kwh: result.avg_power || 0,
            avg_voltage_v: result.avg_voltage || 0,
            max_voltage_v: result.max_voltage || 0,
            min_voltage_v: result.min_voltage || 0,
            avg_current_a: result.avg_current || 0,
            max_current_a: result.max_current || 0,
          });
          filled++;
        }
      }
    } catch (err) {
      console.error(
        `[Aggregator] Backfill error for slot ${startTimeStr}:`,
        err.message,
      );
    }
  }

  if (filled > 0) {
    console.log(
      `[Aggregator] Backfill complete: ${filled} missing slot(s) filled.`,
    );
  } else {
    console.log("[Aggregator] Backfill complete: no missing slots.");
  }
}
```

**Step 2: Modifier `startAggregatorScheduler` pour appeler le backfill au démarrage**

Dans la fonction `startAggregatorScheduler`, remplacer :

```javascript
// Run cleanup once on startup just in case
runCleanup();
```

par :

```javascript
// Run cleanup once on startup just in case
runCleanup();
// Backfill les heures manquantes (48h) en cas de redémarrage après downtime
backfillMissingHours(48).catch((err) =>
  console.error("[Aggregator] Backfill failed:", err),
);
```

**Step 3: Exporter la fonction**

Dans `module.exports`, ajouter `backfillMissingHours` :

```javascript
module.exports = {
  startAggregatorScheduler,
  aggregateHourlyData,
  runCleanup,
  backfillMissingHours,
};
```

**Step 4: Supprimer le TODO**

Supprimer les lignes du commentaire TODO (lignes 6-10 environ) qui décrivent exactement ce qu'on vient d'implémenter.

**Step 5: Lancer les tests existants**

```bash
cd backend && npm test __tests__/cron/aggregator.test.js
```

Expected : tous PASS

**Step 6: Commit**

```bash
git add backend/cron/aggregator.js
git commit -m "feat: add backfill mechanism for missed hourly aggregations"
```

---

## Task 6 : Validation des inputs backend (Zod)

**Files:**

- Modify: `backend/package.json`
- Create: `backend/middleware/validate.js`
- Modify: `backend/routes/auth.js`
- Modify: `backend/routes/users.js`
- Modify: `backend/routes/plants.js`

**Step 1: Installer Zod**

```bash
cd backend && npm install zod
```

**Step 2: Créer le middleware de validation**

```javascript
// backend/middleware/validate.js
const { ZodError } = require("zod");

/**
 * Middleware de validation Zod.
 * Usage: router.post('/route', validate(mySchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({ message: "Validation failed.", errors });
    }
    req.body = result.data; // données nettoyées et typées
    next();
  };
}

module.exports = validate;
```

**Step 3: Créer les schémas et les appliquer dans auth.js**

En haut de `backend/routes/auth.js`, après les `require`, ajouter :

```javascript
const { z } = require("zod");
const validate = require("../middleware/validate");

const loginSchema = z.object({
  username: z.string().min(1, "Username is required.").max(100),
  password: z.string().min(1, "Password is required.").max(200),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200),
});
```

Puis sur chaque route, ajouter le middleware :

- `router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {`
- `router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), async (req, res) => {`
- `router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {`

Retirer les validations manuelles dans chaque handler qui sont maintenant couvertes par Zod (ex: `if (!username || !password)`, `if (!email)`, `if (!token || !password)`, `if (password.length < 8)`).

**Step 4: Lancer tous les tests**

```bash
cd backend && npm test
```

Expected : tous PASS (les tests auth vérifient déjà les 400 pour champs manquants, ils doivent rester verts)

**Step 5: Commit**

```bash
git add backend/package.json backend/middleware/validate.js backend/routes/auth.js
git commit -m "feat: add Zod input validation middleware to auth routes"
```

---

## Task 7 : Resource Limits K8s (Helm values)

**Files:**

- Modify: `hi2-helm/values.yaml`
- Modify: `hi2-helm/templates/deployment-backend.yaml`
- Modify: `hi2-helm/templates/deployment-frontend.yaml`
- Modify: `hi2-helm/templates/deployment-polling.yaml`
- Modify: `hi2-helm/templates/deployment-postgres.yaml`

**Step 1: Lire les 4 templates de deployment**

Lire chaque fichier pour comprendre leur structure actuelle avant de modifier.

**Step 2: Ajouter les resource configs dans values.yaml**

Dans `hi2-helm/values.yaml`, dans la section `backend:`, ajouter :

```yaml
backend:
  replicaCount: 1
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  # ... reste inchangé
```

Dans la section `frontend:`, ajouter :

```yaml
frontend:
  replicaCount: 1
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  # ... reste inchangé
```

Dans la section `postgres:`, ajouter :

```yaml
postgres:
  replicaCount: 1
  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"
  # ... reste inchangé
```

Dans la section `polling:`, ajouter :

```yaml
polling:
  enabled: true
  replicaCount: 1
  resources:
    requests:
      cpu: "50m"
      memory: "128Mi"
    limits:
      cpu: "200m"
      memory: "256Mi"
  # ... reste inchangé
```

**Step 3: Injecter les resources dans chaque template de deployment**

Dans chaque fichier `deployment-*.yaml`, dans le bloc `containers:`, ajouter après `imagePullPolicy` :

```yaml
resources: { { - toYaml .Values.<service>.resources | nindent 12 } }
```

Remplacer `<service>` par `backend`, `frontend`, `postgres`, ou `polling` selon le fichier.

**Step 4: Vérifier la syntaxe Helm**

```bash
helm lint hi2-helm/
```

Expected : "1 chart(s) linted, 0 chart(s) failed"

**Step 5: Commit**

```bash
git add hi2-helm/values.yaml hi2-helm/templates/deployment-backend.yaml hi2-helm/templates/deployment-frontend.yaml hi2-helm/templates/deployment-polling.yaml hi2-helm/templates/deployment-postgres.yaml
git commit -m "feat: add resource requests/limits to all K8s deployments"
```

---

## Task 8 : Documentation Swagger

**Files:**

- Modify: `backend/package.json`
- Create: `backend/swagger.js`
- Modify: `backend/index.js`
- Modify: `backend/routes/auth.js` (JSDoc comments)
- Modify: `backend/routes/plants.js` (JSDoc comments)

**Step 1: Installer les dépendances**

```bash
cd backend && npm install swagger-jsdoc swagger-ui-express
```

**Step 2: Créer backend/swagger.js**

```javascript
// backend/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hyperviseur HI² API",
      version: "1.0.0",
      description: "API de supervision des installations solaires",
    },
    servers: [{ url: "/api", description: "API base path" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/*.js"],
};

module.exports = swaggerJsdoc(options);
```

**Step 3: Monter Swagger dans backend/index.js**

Après les `require` existants, ajouter :

```javascript
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
```

Après `app.use(cookieParser());`, ajouter :

```javascript
// API Documentation (non disponible en production)
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));
  console.log("[Server] Swagger UI available at /api/docs");
}
```

**Step 4: Documenter les routes auth (JSDoc)**

Dans `backend/routes/auth.js`, ajouter avant chaque `router.post` :

```javascript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: MonMotDePasse123!
 *     responses:
 *       200:
 *         description: Connexion réussie, retourne un JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Champs manquants
 *       401:
 *         description: Credentials invalides
 */
```

```javascript
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Demande de réinitialisation de mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email envoyé (même si l'email n'existe pas)
 *       400:
 *         description: Email manquant
 */
```

```javascript
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé
 *       400:
 *         description: Données manquantes ou invalides
 *       404:
 *         description: Token invalide
 *       410:
 *         description: Token expiré
 */
```

**Step 5: Vérifier que Swagger se charge**

Démarrer le backend en local et ouvrir http://localhost:3001/api/docs

Expected : UI Swagger visible avec les routes auth documentées

**Step 6: Commit**

```bash
git add backend/package.json backend/swagger.js backend/index.js backend/routes/auth.js
git commit -m "feat: add Swagger UI documentation at /api/docs"
```

---

## Récapitulatif des commits attendus

1. `test: setup Jest + Supertest infrastructure`
2. `test: add auth middleware unit tests`
3. `test: add auth routes tests (login, forgot-password, reset-password)`
4. `test: add aggregator cron unit tests`
5. `feat: add backfill mechanism for missed hourly aggregations`
6. `feat: add Zod input validation middleware to auth routes`
7. `feat: add resource requests/limits to all K8s deployments`
8. `feat: add Swagger UI documentation at /api/docs`

**Total estimé : ~8 commits, tous indépendants et réversibles.**
