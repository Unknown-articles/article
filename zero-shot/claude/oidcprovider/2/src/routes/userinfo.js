import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

function bearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function handleUserinfo(req, res) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' });

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM tokens WHERE access_token=?').get(token);
  if (!row || row.expires_at < now) return res.status(401).json({ error: 'invalid_token' });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
  const scopes = row.scope.split(' ');
  const claims = { sub: user.id };
  if (scopes.includes('email')) claims.email = user.email;
  if (scopes.includes('profile')) { claims.name = user.name; claims.preferred_username = user.username; }

  return res.json(claims);
}

router.get('/userinfo', handleUserinfo);
router.post('/userinfo', handleUserinfo);

export default router;
