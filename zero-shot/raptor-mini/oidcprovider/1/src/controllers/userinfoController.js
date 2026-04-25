import { getTokenByValue, getUserById } from '../services/authService.js';

function unauthorized(res) {
  return res.status(401).json({ error: 'invalid_token' });
}

export async function userinfo(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return unauthorized(res);
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) {
    return unauthorized(res);
  }

  const tokenRecord = await getTokenByValue(accessToken);
  if (!tokenRecord) {
    return unauthorized(res);
  }

  const user = await getUserById(tokenRecord.user_id);
  if (!user) {
    return unauthorized(res);
  }

  const response = {
    sub: String(user.id),
    name: user.name
  };
  if (tokenRecord.scope.split(' ').includes('email')) {
    response.email = user.email;
  }
  res.json(response);
}
