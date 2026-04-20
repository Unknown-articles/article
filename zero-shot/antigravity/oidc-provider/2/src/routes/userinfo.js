import { Router } from 'express';
import { get } from '../db/index.js';

const router = Router();

const handleUserInfo = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).set('WWW-Authenticate', 'Bearer').send('Unauthorized');
  }

  const token = authHeader.split(' ')[1];

  const activeToken = await get('SELECT * FROM tokens WHERE access_token = ?', [token]);
  
  if (!activeToken || Date.now() > activeToken.expires_at) {
    return res.status(401).set('WWW-Authenticate', 'Bearer error="invalid_token"').send('Unauthorized');
  }

  const user = await get('SELECT * FROM users WHERE id = ?', [activeToken.sub]);
  
  if (!user) {
    return res.status(401).set('WWW-Authenticate', 'Bearer error="invalid_token"').send('Unauthorized');
  }

  const scopes = activeToken.scope ? activeToken.scope.split(' ') : [];
  
  const userInfo = {
    sub: user.id.toString(),
  };

  // We add 'email' scope handling even if oauth req only says 'openid', just to be complete per specs.
  // Although requirement says: present when scope included "email"
  if (scopes.includes('email') && user.email) {
    userInfo.email = user.email;
  }

  res.json(userInfo);
};

router.get('/userinfo', handleUserInfo);
router.post('/userinfo', handleUserInfo);

export default router;
