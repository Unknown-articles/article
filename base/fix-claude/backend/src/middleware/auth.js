import db from '../db/sqliteDb.js';

// Shared token lookup — used by middleware, WebSocket handlers, and OIDC routes
export function lookupToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(token);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  const user = db.prepare('SELECT id,username,email FROM users WHERE id = ?').get(row.user_id);
  return user || null;
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const user = lookupToken(auth.slice(7));
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    req.user = lookupToken(auth.slice(7)) ?? null;
  }
  next();
}
