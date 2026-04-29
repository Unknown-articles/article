import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { validateAccessToken } from '../lib/tokens.js';

const router = Router();

function handleUserinfo(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'unauthorized', error_description: 'Authorization header required' });
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized', error_description: 'Bearer token required' });

  const token = auth.slice(7);
  const record = validateAccessToken(token);
  if (!record) return res.status(401).json({ error: 'invalid_token', error_description: 'Token invalid or expired' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
  const scopes = record.scope.split(' ');

  const claims = { sub: String(user.id) };
  if (scopes.includes('email')) claims.email = user.email;
  if (scopes.includes('profile')) claims.name = user.name;

  res.json(claims);
}

router.get('/userinfo', handleUserinfo);
router.post('/userinfo', handleUserinfo);

export default router;
