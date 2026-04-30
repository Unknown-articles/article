import express from 'express';
import { getToken, getUserById } from '../db.js';

const router = express.Router();

const handleUserInfo = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Authorization header missing');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer') {
    return res.status(401).send('Scheme must be Bearer');
  }

  if (!token) {
    return res.status(401).send('Token missing');
  }

  const tokenRecord = await getToken(token);
  if (!tokenRecord || tokenRecord.expires_at < Date.now()) {
    return res.status(401).send('Invalid or expired token');
  }

  const user = await getUserById(tokenRecord.user_id);
  if (!user) {
    return res.status(401).send('User not found');
  }

  const userInfo = {
    sub: user.username
  };

  if (tokenRecord.scope && tokenRecord.scope.includes('email')) {
    userInfo.email = user.email;
  }

  res.json(userInfo);
};

router.get('/userinfo', handleUserInfo);
router.post('/userinfo', handleUserInfo); // POST /userinfo: must return 200 or 405 (implementation-defined)

export default router;
