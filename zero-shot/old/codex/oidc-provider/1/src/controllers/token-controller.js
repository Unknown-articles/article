import { exchangeAuthorizationCode } from '../services/token-service.js';

export async function issueToken(request, response, next) {
  try {
    const tokenResponse = await exchangeAuthorizationCode({
      database: request.app.locals.database,
      config: request.app.locals.config,
      requestBody: request.body,
    });

    response.json(tokenResponse);
  } catch (error) {
    next(error);
  }
}
