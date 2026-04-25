import { validateAccessToken } from '../services/tokenService.js';
import { getUserById } from '../services/userService.js';

export function getUserInfo(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Authorization header required' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' });
  }

  const token = authHeader.slice(7);
  const tokenRecord = validateAccessToken(token);
  if (!tokenRecord) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token is invalid or expired' });
  }

  const user = getUserById(tokenRecord.user_id);
  if (!user) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'User not found' });
  }

  const scopes = tokenRecord.scope.split(' ');
  const claims = { sub: String(user.id) };

  if (scopes.includes('email')) {
    claims.email = user.email;
  }
  if (scopes.includes('profile')) {
    claims.name = user.name;
  }
  if (scopes.includes('openid')) {
    claims.email = user.email;
  }

  return res.json(claims);
}
