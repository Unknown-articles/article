import { getTokenByAccessToken } from '../services/tokenService.js';

/**
 * Middleware: require a valid Bearer token in the Authorization header.
 * Attaches the token record to req.token on success.
 */
export function requireBearerToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer realm="oidc-provider"')
      .json({ error: 'invalid_token', error_description: 'Bearer token required' });
  }

  const accessToken = authHeader.slice(7).trim();
  const token = getTokenByAccessToken(accessToken);

  if (!token) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer error="invalid_token"')
      .json({ error: 'invalid_token', error_description: 'Token not found or revoked' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (token.expires_at < now) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer error="invalid_token"')
      .json({ error: 'invalid_token', error_description: 'Token has expired' });
  }

  req.token = token;
  next();
}
