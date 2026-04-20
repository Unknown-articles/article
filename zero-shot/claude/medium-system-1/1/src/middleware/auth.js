import { validateAccessToken } from '../services/oidcService.js';

/**
 * Validates the Bearer access_token and attaches req.user = { id, email, role }.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });

  const user = validateAccessToken(header.slice(7));
  if (!user)
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });

  req.user = user;
  next();
}
