import { Router } from 'express';
import store from '../db.js';

const routerInstance = Router();

function findOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    store.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function authenticateRequest(req, res) {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.status(401).json({ error: 'missing Authorization header' });
    return null;
  }
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid Authorization scheme' });
    return null;
  }

  const rawToken = auth.slice(7);
  const tokenEntry = await findOne(
    'SELECT * FROM tokens WHERE access_token = ?',
    [rawToken]
  );

  if (!tokenEntry) {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }
  if (tokenEntry.expires_at < Math.floor(Date.now() / 1000)) {
    res.status(401).json({ error: 'token expired' });
    return null;
  }

  return tokenEntry;
}

routerInstance.get('/userinfo', async (req, res) => {
  const tokenEntry = await authenticateRequest(req, res);
  if (!tokenEntry) return;

  const user = await findOne('SELECT * FROM users WHERE id = ?', [tokenEntry.user_id]);

  const claims = { sub: String(tokenEntry.user_id) };
  if (tokenEntry.scope.split(' ').includes('email')) {
    claims.email = user.email;
  }

  res.status(200).json(claims);
});

routerInstance.post('/userinfo', (req, res) => {
  res.status(405).set('Allow', 'GET').json({ error: 'method_not_allowed' });
});

export default routerInstance;
