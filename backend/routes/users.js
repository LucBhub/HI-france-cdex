const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth");

// List Users
router.get("/", authMiddleware(["superadmin"]), async (req, res) => {
  try {
    const users = await knex("users").select("id", "username", "email", "role");
    res.json(users);
  } catch (error) {
    console.error("[Users] Error fetching users:", error);
    res.status(500).json({
      message: "Failed to fetch users.",
      debug: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

// Create User
router.post("/", authMiddleware(["superadmin"]), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [newUser] = await knex("users")
      .insert({
        username,
        email,
        password: hashedPassword,
        role,
      })
      .returning(["id", "username", "email", "role"]);

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === "SQLITE_CONSTRAINT") {
      return res
        .status(409)
        .json({ message: "Username or email already exists." });
    }
    res.status(500).json({ message: "Failed to create user." });
  }
});

// Delete User
router.delete("/:id", authMiddleware(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  // Prevent superadmin from deleting themselves
  if (req.user.id === userId) {
    return res
      .status(403)
      .json({ message: "Superadmin cannot delete themselves." });
  }

  try {
    const userToDelete = await knex("users").where({ id: userId }).first();
    if (!userToDelete) {
      return res.status(404).json({ message: "User not found." });
    }
    if (userToDelete.role === "superadmin") {
      return res
        .status(403)
        .json({ message: "Cannot delete a superadmin account." });
    }

    const deletedCount = await knex("users").where({ id: userId }).del();
    if (deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    res.status(500).json({ message: "Error deleting user." });
  }
});

// Admin Reset Password (send email)
router.post(
  "/:id/password-reset",
  authMiddleware(["superadmin"]),
  async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    try {
      const user = await knex("users").where({ id: userId }).first();
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Generate token
      const crypto = require("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expires_at = new Date(Date.now() + 3600000); // 1 hour

      // Invalidate old tokens
      await knex("password_resets").where({ email: user.email }).del();

      // Store new token
      await knex("password_resets").insert({
        email: user.email,
        token,
        expires_at,
      });

      const FRONTEND_BASE_URL =
        process.env.FRONTEND_BASE_URL || "http://localhost:3000";
      const resetLink = `${FRONTEND_BASE_URL}/reset-password?token=${token}`;

      // Send Email
      const { sendEmail } = require("../services/email-service");
      try {
        await sendEmail({
          to: user.email,
          templateKey: "ADMIN_RESET",
          lang: user.language || "en",
          data: resetLink,
        });
        res.json({ success: true, message: "Reset email sent." });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);

        // Fallback: Return link to Admin in response (even in PROD)
        // This ensures the admin can still reset the password if SMTP/Azure is down.
        return res.json({
          success: true,
          message: "Email failed to send. Check console/network for link.",
          debugLink: resetLink,
        });
      }
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Server error." });
    }
  },
);

// Update User Role
router.put("/:id/role", authMiddleware(["superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const userId = parseInt(id, 10);

  // Validate inputs
  const allowedRoles = ["superadmin", "admin", "member", "viewer", "user"];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid or missing role." });
  }

  // Prevent changing own role (safety mechanism)
  if (req.user.id === userId) {
    return res
      .status(403)
      .json({ message: "You cannot change your own role." });
  }

  try {
    const user = await knex("users").where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent modifying other superadmins
    if (user.role === "superadmin") {
      return res
        .status(403)
        .json({ message: "Cannot modify a superadmin account." });
    }

    await knex("users").where({ id: userId }).update({ role });

    // Log auditing
    const { logAudit } = require("../utils/audit-logger");
    await logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "USER_UPDATE_ROLE",
      targetType: "USER",
      targetId: userId,
      details: `Updated role for user ${user.username} to ${role}`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: "User role updated successfully.",
      role,
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Server error updating role." });
  }
});

module.exports = router;
