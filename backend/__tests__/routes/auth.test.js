// Tests d'intégration pour les routes d'authentification
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const request = require("supertest");
const express = require("express");

// Mocks déclarés avant tout require des modules métier
jest.mock("../../db/knex", () => jest.fn());
jest.mock("../../utils/audit-logger", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../services/email-service", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue("salt"),
  hash: jest.fn().mockResolvedValue("newhashedpassword"),
}));

const knex = require("../../db/knex");
const bcrypt = require("bcryptjs");

// App Express minimaliste pour les tests
const authRouter = require("../../routes/auth");
const app = express();
app.use(express.json());
app.use("/", authRouter);

// Crée un chain knex fluent avec firstValue comme retour de .first()
const makeChain = (firstValue) => ({
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(firstValue),
  del: jest.fn().mockResolvedValue(1),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// POST /login
// ──────────────────────────────────────────────
describe("POST /login", () => {
  test("400 si username ou password manquant", async () => {
    const res = await request(app).post("/login").send({ username: "alice" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test("401 si utilisateur introuvable", async () => {
    knex.mockReturnValue(makeChain(undefined));

    const res = await request(app)
      .post("/login")
      .send({ username: "nobody", password: "pw" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials.");
  });

  test("401 si mot de passe incorrect", async () => {
    knex.mockReturnValue(
      makeChain({
        id: 1,
        username: "alice",
        password: "hash",
        role: "admin",
        email: "a@b.com",
      }),
    );
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post("/login")
      .send({ username: "alice", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials.");
  });

  test("200 avec token si identifiants valides", async () => {
    knex.mockReturnValue(
      makeChain({
        id: 1,
        username: "alice",
        password: "hash",
        role: "admin",
        email: "a@b.com",
      }),
    );
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post("/login")
      .send({ username: "alice", password: "correct" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe("alice");
    expect(res.body.user.password).toBeUndefined(); // Ne jamais renvoyer le hash
  });
});

// ──────────────────────────────────────────────
// POST /forgot-password
// ──────────────────────────────────────────────
describe("POST /forgot-password", () => {
  test("400 si email manquant", async () => {
    const res = await request(app).post("/forgot-password").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email is required.");
  });

  test("200 même si l'email n'existe pas (sécurité — pas de user enumeration)", async () => {
    knex.mockReturnValue(makeChain(undefined));

    const res = await request(app)
      .post("/forgot-password")
      .send({ email: "ghost@x.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if a user/i);
  });

  test("200 quand l'utilisateur existe et que l'email est envoyé", async () => {
    // 1er appel : users.where.first → retourne l'utilisateur
    // Appels suivants : password_resets.del et .insert
    knex
      .mockReturnValueOnce(makeChain({ id: 1, email: "alice@x.com" }))
      .mockReturnValue(makeChain(undefined));

    const res = await request(app)
      .post("/forgot-password")
      .send({ email: "alice@x.com" });

    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────
// POST /reset-password
// ──────────────────────────────────────────────
describe("POST /reset-password", () => {
  test("400 si token ou password manquant", async () => {
    const res = await request(app)
      .post("/reset-password")
      .send({ token: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test("400 si le password est trop court (< 8 caractères)", async () => {
    const res = await request(app)
      .post("/reset-password")
      .send({ token: "abc", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  test("404 si le token est invalide ou inexistant", async () => {
    knex.mockReturnValue(makeChain(undefined));

    const res = await request(app)
      .post("/reset-password")
      .send({ token: "badtoken", password: "newpassword" });

    expect(res.status).toBe(404);
  });

  test("200 et mot de passe réinitialisé avec token valide", async () => {
    const futureDate = new Date(Date.now() + 3600000);
    // 1er appel : password_resets.where.first → token valide
    // 2e appel  : users.where.first → utilisateur
    // Appels suivants : users.update et password_resets.del
    knex
      .mockReturnValueOnce(
        makeChain({ email: "alice@x.com", expires_at: futureDate }),
      )
      .mockReturnValueOnce(makeChain({ id: 1, email: "alice@x.com" }))
      .mockReturnValue(makeChain(undefined));

    const res = await request(app)
      .post("/reset-password")
      .send({ token: "validtoken", password: "newpassword123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
