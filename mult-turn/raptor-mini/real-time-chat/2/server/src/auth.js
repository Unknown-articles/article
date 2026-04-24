import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "default_jwt_secret";

export function signToken(payload) {
  return jwt.sign(payload, SECRET_KEY);
}

export function decodeToken(token) {
  return jwt.verify(token, SECRET_KEY);
}

export function jwtGuard(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = match[1];

  try {
    const decoded = decodeToken(token);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
