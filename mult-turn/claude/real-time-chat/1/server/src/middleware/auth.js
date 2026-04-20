import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
