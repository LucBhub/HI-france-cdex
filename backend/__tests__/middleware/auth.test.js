// Tests unitaires pour le middleware d'authentification JWT
process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const authMiddleware = require("../../middleware/auth");

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe("authMiddleware — sans service token", () => {
  test("retourne 401 si pas de header Authorization", () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token provided." });
    expect(next).not.toHaveBeenCalled();
  });

  test("retourne 401 si header Authorization sans token (Bearer seul)", () => {
    const req = { headers: { authorization: "Bearer" } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Malformed token." });
    expect(next).not.toHaveBeenCalled();
  });

  test("retourne 401 pour un JWT invalide", () => {
    const req = { headers: { authorization: "Bearer invalid.token.here" } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token." });
  });

  test("appelle next() avec un JWT valide (sans restriction de rôle)", () => {
    const token = jwt.sign(
      { id: 1, username: "alice", role: "admin" },
      "test-secret",
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe("alice");
    expect(req.user.role).toBe("admin");
  });

  test("retourne 403 si le rôle ne correspond pas", () => {
    const token = jwt.sign(
      { id: 1, username: "alice", role: "viewer" },
      "test-secret",
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(["admin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Forbidden: Insufficient role.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("appelle next() si le rôle correspond", () => {
    const token = jwt.sign(
      { id: 1, username: "alice", role: "admin" },
      "test-secret",
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(["admin", "superadmin"])(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("authMiddleware — avec service token", () => {
  let middlewareWithToken;

  beforeAll(() => {
    process.env.POLLING_SERVICE_TOKEN = "secret-service-token";
    jest.resetModules();
    middlewareWithToken = require("../../middleware/auth");
  });

  afterAll(() => {
    delete process.env.POLLING_SERVICE_TOKEN;
    jest.resetModules();
  });

  test("accepte un service token valide et pose req.user", () => {
    const req = {
      headers: { "x-service-token": "secret-service-token" },
    };
    const res = makeRes();
    const next = jest.fn();

    middlewareWithToken()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe("polling-service");
    expect(req.user.role).toBe("service_account");
  });

  test("rejette un mauvais service token et demande un JWT", () => {
    const req = { headers: { "x-service-token": "wrong-token" } };
    const res = makeRes();
    const next = jest.fn();

    middlewareWithToken()(req, res, next);

    // Pas de JWT non plus → 401
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
