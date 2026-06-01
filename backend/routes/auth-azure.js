const express = require("express");
const router = express.Router();
const axios = require("axios");
const qs = require("qs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const knex = require("../db/knex");
const { logAudit } = require("../utils/audit-logger");
const jwksClient = require("jwks-rsa");

// Environment variables
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_REDIRECT_URI = process.env.AZURE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;

// Helper to check if Azure is configured
const isAzureConfigured = () => {
  const missing = [];
  if (!AZURE_TENANT_ID) missing.push("AZURE_TENANT_ID");
  if (!AZURE_CLIENT_ID) missing.push("AZURE_CLIENT_ID");
  if (!AZURE_CLIENT_SECRET) missing.push("AZURE_CLIENT_SECRET");
  if (!AZURE_REDIRECT_URI) missing.push("AZURE_REDIRECT_URI");
  if (!FRONTEND_BASE_URL) missing.push("FRONTEND_BASE_URL");

  if (missing.length > 0) {
    console.error("[Azure Auth] Missing configuration:", missing.join(", "));
    return false;
  }
  return true;
};

// JWKS Client for signature verification
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/discovery/v2.0/keys`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      console.error("[Azure Auth] Error getting signing key:", err);
      return callback(err, null);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// GET /api/auth/azure/login
// Redirects user to Microsoft Login
router.get("/login", (req, res) => {
  if (!isAzureConfigured()) {
    const missing = [];
    if (!AZURE_TENANT_ID) missing.push("AZURE_TENANT_ID");
    if (!AZURE_CLIENT_ID) missing.push("AZURE_CLIENT_ID");
    if (!AZURE_CLIENT_SECRET) missing.push("AZURE_CLIENT_SECRET");
    if (!AZURE_REDIRECT_URI) missing.push("AZURE_REDIRECT_URI");
    if (!FRONTEND_BASE_URL) missing.push("FRONTEND_BASE_URL");
    console.error("[Azure Auth] Configuration missing:", missing);
    return res.status(500).json({
      message: "Azure Auth not configured on server.",
      missing: missing,
    });
  }

  const authEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`;

  const params = {
    client_id: AZURE_CLIENT_ID,
    response_type: "code",
    redirect_uri: AZURE_REDIRECT_URI,
    response_mode: "query",
    scope: "openid profile email offline_access",
    state: "some_random_state_for_security", // Idealement généré aléatoirement
  };

  const url = `${authEndpoint}?${qs.stringify(params)}`;
  res.redirect(url);
});

// GET /api/auth/azure/callback
// Handles return from Microsoft
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("[Azure Auth] Error from Microsoft:", error);
    return res.redirect(`${FRONTEND_BASE_URL}/login?error=azure_auth_failed`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_BASE_URL}/login?error=no_code`);
  }

  try {
    // 1. Exchange Code for Token
    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await axios.post(
      tokenEndpoint,
      qs.stringify({
        client_id: AZURE_CLIENT_ID,
        scope: "openid profile email offline_access",
        code: code,
        redirect_uri: AZURE_REDIRECT_URI,
        grant_type: "authorization_code",
        client_secret: AZURE_CLIENT_SECRET,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const { access_token, id_token } = tokenResponse.data;

    // 2. Verify Token Signature
    console.log("[Azure Auth] Verifying ID Token signature...");
    const decodedIdToken = await new Promise((resolve, reject) => {
      jwt.verify(
        id_token,
        getKey,
        {
          algorithms: ["RS256"],
          // Microsoft issuer can vary (v2.0 vs v1.0), usually v2.0 for this endpoint
          // We check audience strictly
          audience: AZURE_CLIENT_ID,
        },
        (err, decoded) => {
          if (err) {
            console.error("[Azure Auth] JWT Verification Failed:", err.message);
            return reject(err);
          }
          resolve(decoded);
        },
      );
    });

    const email = decodedIdToken.email || decodedIdToken.preferred_username;
    const name = decodedIdToken.name;

    // 2.1 Fetch Profile for Language (PreferredLanguage might be in ID Token, but often needs Graph call)
    let preferredLanguage = "en";
    try {
      console.log("[Azure Auth] Fetching user profile for language...");
      const profileResponse = await axios.get(
        "https://graph.microsoft.com/v1.0/me",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      );
      if (profileResponse.data.preferredLanguage) {
        // Normalize: "fr-FR" or "fr" -> "fr"
        preferredLanguage = profileResponse.data.preferredLanguage
          .split("-")[0]
          .toLowerCase();
        console.log("[Azure Auth] Found preferred language:", preferredLanguage);
      }
    } catch (profileErr) {
      console.warn(
        "[Azure Auth] Failed to fetch profile language (defaulting to en):",
        profileErr.message,
      );
    }

    if (!email) {
      throw new Error("No email found in Azure Token");
    }

    console.log("[Azure Auth] Authenticated:", email);

    // 3. User Provisioning
    let user = await knex("users").where({ email }).first();

    // Check if this user should be superadmin
    const isSuperAdminEmail =
      email.toLowerCase() === "l.boillat@reden.solar" ||
      (process.env.SUPERADMIN_EMAIL &&
        email.toLowerCase() === process.env.SUPERADMIN_EMAIL.toLowerCase());

    if (!user) {
      console.log("[Azure Auth] New user detected, provisioning:", email);
      const newUser = {
        username: name || email.split("@")[0],
        email: email,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        role: isSuperAdminEmail ? "superadmin" : "member",
        language: preferredLanguage,
      };
      const [id] = await knex("users").insert(newUser).returning("id");
      // Fix: returning('id') returns an object in knex pg, need to extract
      user = { id: id.id || id, ...newUser };

      await logAudit({
        userId: user.id,
        username: user.username,
        action: "USER_CREATE_AUTO",
        targetType: "USER",
        targetId: user.id,
        details: `User auto-provisioned via Azure AD (Role: ${newUser.role}, Lang: ${preferredLanguage})`,
        ipAddress: req.ip,
      });
    } else {
      // Existing user: Update language if it changed or was empty
      await knex("users")
        .where({ id: user.id })
        .update({
          language: preferredLanguage,
          ...(isSuperAdminEmail && user.role !== "superadmin"
            ? { role: "superadmin" }
            : {}),
        });

      if (isSuperAdminEmail && user.role !== "superadmin") {
        console.log("[Azure Auth] Upgrading user to superadmin:", email);
        user.role = "superadmin";
      }
      user.language = preferredLanguage;
    }

    // 4. Generate Local Session Token
    const localToken = jwt.sign(
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

    // 5. Audit Log Login
    await logAudit({
      userId: user.id,
      username: user.username,
      action: "LOGIN_AZURE",
      targetType: "SYSTEM",
      targetId: 0,
      details: "User logged in via Azure AD",
      ipAddress: req.ip,
    });

    // 6. Set short-lived secure exchange cookie and redirect to Frontend
    res.cookie("auth_exchange", localToken, {
      maxAge: 30 * 1000, // 30 seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.redirect(`${FRONTEND_BASE_URL}/login-success`);
  } catch (err) {
    console.error("[Azure Auth] Exception during callback:", err);
    if (err.response) {
      console.error(
        "[Azure Auth] Azure Error Data:",
        JSON.stringify(err.response.data, null, 2),
      );
    }
    // Avoid sending another response if one was already sent (e.g. inside verify execution)
    if (!res.headersSent) {
      res.redirect(
        `${FRONTEND_BASE_URL}/login?error=callback_exception&message=${encodeURIComponent(err.message)}`,
      );
    }
  }
});

// GET /api/auth/azure/exchange
// Called by frontend via fetch() to exchange the short-lived cookie for the JWT token securely
router.get("/exchange", (req, res) => {
  // Requires cookie-parser to be configured in index.js
  const token = req.cookies.auth_exchange;

  if (!token) {
    console.error("[Azure Auth] No exchange token found in cookies");
    return res
      .status(401)
      .json({ success: false, message: "No exchange token found" });
  }

  // Clear the exchange cookie so it can only be used once (One-time-use)
  res.clearCookie("auth_exchange");

  res.json({ success: true, token });
});

module.exports = router;
