import { verifyAccessToken } from '../services/token-service.js';
import { unauthorized } from '../utils/errors.js';

export async function authenticateBearer(request, response, next) {
  try {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw unauthorized('invalid_token', 'A Bearer access token is required');
    }

    const token = authorization.slice('Bearer '.length);
    request.auth = await verifyAccessToken({
      database: request.app.locals.database,
      config: request.app.locals.config,
      accessToken: token,
    });

    next();
  } catch (error) {
    next(error);
  }
}
