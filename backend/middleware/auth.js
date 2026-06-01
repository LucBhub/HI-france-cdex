const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_TOKEN = process.env.POLLING_SERVICE_TOKEN || null;

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    // console.log('[AUTH] Request to:', req.path, 'Required roles:', roles);

    if (SERVICE_TOKEN) {
      const serviceTokenHeader = req.headers["x-service-token"];
      if (serviceTokenHeader && serviceTokenHeader === SERVICE_TOKEN) {
        req.user = {
          id: null,
          username: "polling-service",
          role: "service_account", // SECURITY FIX: Restricted role, not superadmin
        };
        return next();
      }
    }

    const authHeader = req.headers.authorization;
    // console.log('[AUTH] Authorization header:', authHeader ? 'present' : 'missing');

    if (!authHeader) {
      // console.log('[AUTH] REJECTED: No token provided');
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      // console.log('[AUTH] REJECTED: Malformed token');
      return res.status(401).json({ message: "Malformed token." });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // console.log('[AUTH] Token decoded, user:', decoded.username, 'role:', decoded.role);
      req.user = decoded;

      if (roles.length > 0 && !roles.includes(decoded.role)) {
        // console.log('[AUTH] REJECTED: Role', decoded.role, 'not in', roles);
        return res
          .status(403)
          .json({ message: "Forbidden: Insufficient role." });
      }

      // console.log('[AUTH] ACCEPTED');
      next();
    } catch (error) {
      console.log("[AUTH] REJECTED: Invalid token -", error.message);
      return res.status(401).json({ message: "Invalid token." });
    }
  };
};

module.exports = authMiddleware;
