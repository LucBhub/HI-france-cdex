// Middleware générique de validation Zod.
// Renvoie 400 avec le premier message d'erreur si req.body ne correspond pas au schéma.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Validation error.";
    return res.status(400).json({ message });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
