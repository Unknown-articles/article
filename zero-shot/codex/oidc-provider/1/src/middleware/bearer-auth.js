import { findAccessToken } from '../services/access-token-service.js';

export async function requireBearerToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Authorization header is required.',
    });
    return;
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Authorization scheme must be Bearer.',
    });
    return;
  }

  const accessToken = await findAccessToken(token);

  if (!accessToken || new Date(accessToken.expires_at).getTime() <= Date.now()) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Access token is invalid or expired.',
    });
    return;
  }

  req.accessToken = accessToken;
  next();
}
