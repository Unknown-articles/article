import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!bearerToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tokenPayload = jwt.verify(bearerToken, process.env.JWT_SECRET ?? 'dev-secret');
    req.user = { userId: tokenPayload.userId, username: tokenPayload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
