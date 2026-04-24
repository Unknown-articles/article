import { Router } from 'express';
import database from '../db.js';

const apiRouter = Router();

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function validateToken(req, res) {
  const auth = req.headers['authorization'];
  if (!auth) {
    res.status(401).json({ error: 'missing Authorization header' });
    return null;
  }
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'invalid Authorization scheme' });
    return null;
  }

  const bearerValue = auth.slice(7);
  const tokenRow = await queryOne(
    'SELECT * FROM tokens WHERE access_token = ?',
    [bearerValue]
  );

  if (!tokenRow) {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }
  if (tokenRow.expires_at < Math.floor(Date.now() / 1000)) {
    res.status(401).json({ error: 'token expired' });
    return null;
  }

  return tokenRow;
}

apiRouter.get('/userinfo', async (req, res) => {
  const tokenRow = await validateToken(req, res);
  if (!tokenRow) return;

  const user = await queryOne('SELECT * FROM users WHERE id = ?', [tokenRow.user_id]);

  const claims = { sub: String(tokenRow.user_id) };
  if (tokenRow.scope.split(' ').includes('email')) {
    claims.email = user.email;
  }

  res.status(200).json(claims);
});

apiRouter.post('/userinfo', (req, res) => {
  res.status(405).set('Allow', 'GET').json({ error: 'method_not_allowed' });
});

export default apiRouter;
