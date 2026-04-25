import express from 'express';
import { getToken, getUserById } from '../services/auth.js';

const router = express.Router();

router.get('/userinfo', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const accessToken = authHeader.substring(7);
  const token = await getToken(accessToken);
  if (!token || token.expires_at < Date.now()) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const user = await getUserById(token.user_id);
  res.json({
    sub: user.username,
    email: user.email,
    name: user.name
  });
});

export default router;