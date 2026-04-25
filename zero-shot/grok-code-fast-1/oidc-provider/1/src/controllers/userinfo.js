import { getToken, getUserById } from '../models/db.js';

export async function getUserInfo(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.split(' ')[1];
  const tokenData = await getToken(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const user = await getUserById(tokenData.user_id);
  const response = { sub: user.id.toString() };
  if (tokenData.scope.includes('email')) {
    response.email = user.email;
  }
  res.json(response);
}