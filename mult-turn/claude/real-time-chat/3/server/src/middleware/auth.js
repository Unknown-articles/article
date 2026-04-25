import jwt from 'jsonwebtoken';

export function verifyAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization ?? '';
  const accessToken = authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice(7) : null;

  if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET ?? 'dev-secret');
    req.user = { userId: decoded.userId, username: decoded.username };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
