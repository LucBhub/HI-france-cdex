const { z } = require("zod");

// z.preprocess coerce undefined → '' pour que min(1, msg) couvre les champs absents ET vides
const req = (msg) =>
  z.preprocess((v) => (v == null ? "" : v), z.string().min(1, msg));

const loginSchema = z.object({
  username: req("Username and password are required."),
  password: req("Username and password are required."),
});

const forgotPasswordSchema = z.object({
  email: req("Email is required."),
});

const resetPasswordSchema = z.object({
  token: req("Token and new password are required."),
  password: z.preprocess(
    (v) => (v == null ? "" : v),
    z
      .string()
      .min(1, "Token and new password are required.")
      .min(8, "Password must be at least 8 characters long."),
  ),
});

module.exports = { loginSchema, forgotPasswordSchema, resetPasswordSchema };
