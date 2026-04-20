import { validateAccessToken } from '../services/authService.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = auth.slice(7);

  const user = validateAccessToken(token);
  if (!user) return res.status(401).json({ error: 'invalid_token_or_user' });

  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next();
  const token = auth.slice(7);
  
  req.user = validateAccessToken(token);
  next();
}
