import db from '../db/sqliteDb.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = auth.slice(7);

  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(token);
  if (!row || new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'invalid_token' });

  const user = db.prepare('SELECT id,username,email FROM users WHERE id = ?').get(row.user_id);
  if (!user) return res.status(401).json({ error: 'user_not_found' });

  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next();
  const token = auth.slice(7);
  const row = db.prepare('SELECT * FROM tokens WHERE access_token = ?').get(token);
  if (row && new Date(row.expires_at) >= new Date()) {
    const user = db.prepare('SELECT id,username,email FROM users WHERE id = ?').get(row.user_id);
    req.user = user || null;
  }
  next();
}
