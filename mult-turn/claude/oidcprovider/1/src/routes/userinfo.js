import { Router } from 'express';
import db from '../db.js';

const router = Router();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function authenticate(req, res) {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.status(401).json({ error: 'missing Authorization header' });
    return null;
  }
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid Authorization scheme' });
    return null;
  }

  const accessToken = auth.slice(7);
  const token = await dbGet(
    'SELECT * FROM tokens WHERE access_token = ?',
    [accessToken]
  );

  if (!token) {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }
  if (token.expires_at < Math.floor(Date.now() / 1000)) {
    res.status(401).json({ error: 'token expired' });
    return null;
  }

  return token;
}

router.get('/userinfo', async (req, res) => {
  const token = await authenticate(req, res);
  if (!token) return;

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [token.user_id]);

  const claims = { sub: String(token.user_id) };
  if (token.scope.split(' ').includes('email')) {
    claims.email = user.email;
  }

  res.status(200).json(claims);
});

router.post('/userinfo', (req, res) => {
  res.status(405).set('Allow', 'GET').json({ error: 'method_not_allowed' });
});

export default router;
