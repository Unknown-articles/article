import jwt from "jsonwebtoken";

const AUTH_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

export function generateJwt(payload) {
  return jwt.sign(payload, AUTH_SECRET);
}

export function validateJwt(token) {
  return jwt.verify(token, AUTH_SECRET);
}

export function tokenGuard(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = match[1];

  try {
    const decoded = validateJwt(token);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
