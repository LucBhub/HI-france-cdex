const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { logAudit } = require("../utils/audit-logger");
const { sendEmail } = require("../services/email-service");
const validate = require("../middleware/validate");
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../schemas/auth");

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:3000";

// Rate limiter for login (prevent brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per 15 minutes
  message: {
    message:
      "Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for forgot-password (prevent abuse)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    message:
      "Trop de demandes de réinitialisation, veuillez réessayer dans 1 heure.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authentification par identifiant / mot de passe
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
 *                 format: password
 *     responses:
 *       200:
 *         description: JWT + profil utilisateur
 *       400:
 *         description: Champs manquants
 *       401:
 *         description: Identifiants invalides
 *       429:
 *         description: Trop de tentatives (rate-limit)
 */
// Login
router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  console.log("[Auth] Login attempt for:", username);

  try {
    console.log("[Auth] Finding user...");
    const user = await knex("users").where({ username }).first();
    if (!user) {
      console.log("[Auth] User not found.");
      return res.status(401).json({ message: "Invalid credentials." });
    }

    console.log("[Auth] Verifying password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("[Auth] Password mismatch.");
      // Safely attempt audit log
      try {
        await logAudit({
          userId: user.id,
          username: user.username,
          action: "LOGIN_FAILED",
          targetType: "SYSTEM",
          targetId: 0,
          details: "Invalid password",
          ipAddress: req.ip || "0.0.0.0",
        });
      } catch (auditError) {
        console.error("[Auth] Audit log failed (ignored):", auditError.message);
      }
      return res.status(401).json({ message: "Invalid credentials." });
    }

    console.log("[Auth] Signing token...");
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in server configuration!");
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        language: user.language,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    const { password: _, ...userWithoutPassword } = user;

    // Log successful login
    try {
      await logAudit({
        userId: user.id,
        username: user.username,
        action: "LOGIN",
        targetType: "SYSTEM",
        targetId: 0,
        details: "User logged in",
        ipAddress: req.ip || "0.0.0.0",
      });
    } catch (auditError) {
      console.error("[Auth] Audit log failed (ignored):", auditError.message);
    }

    console.log("[Auth] Login successful.");
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    console.error("[Auth] CRITICAL Login error:", error);

    // Try to log failure
    try {
      await logAudit({
        userId: null,
        username: username || "unknown",
        action: "LOGIN_FAILED",
        targetType: "SYSTEM",
        targetId: 0,
        details: `Login failed (Exception): ${error.message}`,
        ipAddress: req.ip || "0.0.0.0",
      });
    } catch (auditErr) {
      console.error(
        "[Auth] Audit log failed during error handling:",
        auditErr.message,
      );
    }

    // Return JSON even for 500 to satisfy client
    const isProduction = process.env.NODE_ENV === "production";
    res.status(500).json({
      message: "Server error during login.",
      ...(isProduction ? {} : { debug: error.message, stack: error.stack }),
    });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
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
 *         description: Email envoyé (réponse identique que l'email existe ou non)
 *       400:
 *         description: Email manquant
 *       429:
 *         description: Trop de demandes (rate-limit)
 */
// Forgot Password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  async (req, res) => {
    const { email } = req.body;

    try {
      const user = await knex("users").where({ email }).first();
      if (!user) {
        // IMPORTANT: For security, don't reveal if the user exists or not.
        return res.status(200).json({
          message:
            "If a user with this email exists, a password reset link has been sent.",
        });
      }

      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expires_at = new Date(Date.now() + 3600000); // 1 hour from now

      // Store token in the database
      await knex("password_resets").where({ email }).del();
      await knex("password_resets").insert({ email, token, expires_at });

      const resetLink = `${FRONTEND_BASE_URL}/reset-password?token=${token}`;

      // Send email (Azure Graph or SMTP)
      try {
        await sendEmail({
          to: user.email,
          templateKey: "FORGOT_PASSWORD",
          lang: user.language || "en",
          data: resetLink,
        });
      } catch (emailError) {
        console.error(
          "[Forgot Password] Failed to send email:",
          emailError.message,
        );
        // Fallback for dev/debug
        if (process.env.NODE_ENV !== "production") {
          console.log("--- PASSWORD RESET (FALLBACK) ---");
          console.log(`User: ${user.email}`);
          console.log(`Reset Link: ${resetLink}`);
          console.log("---------------------------------");
        }
      }

      res.status(200).json({
        message:
          "If a user with this email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res
        .status(500)
        .json({ message: "An error occurred while processing your request." });
    }
  },
);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   get:
 *     summary: Valider un token de réinitialisation
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token valide
 *       404:
 *         description: Token invalide ou expiré
 *       410:
 *         description: Token expiré
 */
// Validate Reset Token
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ message: "Token is required." });
  }

  try {
    const record = await knex("password_resets").where({ token }).first();
    if (!record) {
      return res.status(404).json({ message: "Invalid or expired token." });
    }

    if (new Date(record.expires_at) < new Date()) {
      await knex("password_resets").where({ token }).del();
      return res.status(410).json({ message: "Token has expired." });
    }

    return res.json({ message: "Token is valid." });
  } catch (error) {
    console.error("Validate reset token error:", error);
    return res.status(500).json({ message: "Server error validating token." });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe avec un token valide
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
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé
 *       400:
 *         description: Champs manquants ou mot de passe trop court
 *       404:
 *         description: Token invalide
 *       410:
 *         description: Token expiré
 */
// Reset Password
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req, res) => {
    const { token, password } = req.body;

    try {
      const record = await knex("password_resets").where({ token }).first();
      if (!record) {
        return res.status(404).json({ message: "Invalid or expired token." });
      }

      if (new Date(record.expires_at) < new Date()) {
        await knex("password_resets").where({ token }).del();
        return res.status(410).json({ message: "Token has expired." });
      }

      const user = await knex("users").where({ email: record.email }).first();
      if (!user) {
        await knex("password_resets").where({ token }).del();
        return res
          .status(404)
          .json({ message: "User not found for provided token." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await knex("users")
        .where({ id: user.id })
        .update({ password: hashedPassword });
      await knex("password_resets").where({ email: record.email }).del();

      return res.json({
        success: true,
        message: "Password has been reset successfully.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res
        .status(500)
        .json({ message: "Server error resetting password." });
    }
  },
);

module.exports = router;
