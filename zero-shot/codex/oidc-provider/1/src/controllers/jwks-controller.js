import { getPublicJwks, rotateSigningKeys } from '../services/key-service.js';

export async function getJwks(request, response, next) {
  try {
    const jwks = await getPublicJwks(request.app.locals.database);
    response.json(jwks);
  } catch (error) {
    next(error);
  }
}

export async function rotateJwks(request, response, next) {
  try {
    const key = await rotateSigningKeys(request.app.locals.database);
    response.status(201).json({
      kid: key.kid,
      status: 'rotated',
    });
  } catch (error) {
    next(error);
  }
}
