import { getUserByAccessToken, readBearerToken } from '../services/tokenService.js';

export function requireAuth(req, res, next) {
  const token = readBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const user = getUserByAccessToken(token);
  if (!user) return res.status(401).json({ error: 'user_not_found' });

  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const token = readBearerToken(req.headers.authorization);
  if (!token) return next();
  req.user = getUserByAccessToken(token);
  next();
}
