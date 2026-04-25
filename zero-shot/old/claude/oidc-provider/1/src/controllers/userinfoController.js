import { getUserById } from '../services/userService.js';

/** GET /userinfo (requires Bearer token via requireBearerToken middleware) */
export function getUserInfo(req, res) {
  const user = getUserById(req.token.user_id);
  if (!user) {
    return res.status(404).json({ error: 'not_found', error_description: 'User not found' });
  }

  const scopes  = req.token.scope.split(/\s+/);
  const claims  = { sub: user.id };

  if (scopes.includes('profile')) {
    claims.name               = user.name;
    claims.preferred_username = user.username;
  }

  if (scopes.includes('email')) {
    claims.email = user.email;
  }

  res.json(claims);
}
