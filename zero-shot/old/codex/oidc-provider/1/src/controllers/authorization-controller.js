import { createAuthorizationCode, requireAuthenticatedUser, validateAuthorizationRequest } from '../services/authorization-service.js';
import { findClientById } from '../services/client-service.js';
import { authenticateUser } from '../services/user-service.js';
import { badRequest } from '../utils/errors.js';

export async function authorize(request, response, next) {
  try {
    const { client_id: clientId, login_hint: email, password } = request.query;
    if (!clientId) {
      throw badRequest('invalid_request', 'client_id is required');
    }

    const client = await findClientById(request.app.locals.database, clientId);
    if (!client) {
      throw badRequest('invalid_client', 'Unknown client_id');
    }

    validateAuthorizationRequest({ client, query: request.query });

    const user = await authenticateUser(request.app.locals.database, email, password);
    requireAuthenticatedUser(user);

    const authorizationCode = await createAuthorizationCode(request.app.locals.database, {
      clientId: client.clientId,
      userId: user.id,
      redirectUri: request.query.redirect_uri,
      scope: request.query.scope,
      codeChallenge: request.query.code_challenge,
      codeChallengeMethod: request.query.code_challenge_method,
    });

    response.json({
      code: authorizationCode.code,
      expires_at: authorizationCode.expiresAt,
      state: request.query.state ?? null,
      redirect_to: `${request.query.redirect_uri}?code=${authorizationCode.code}${request.query.state ? `&state=${request.query.state}` : ''}`,
    });
  } catch (error) {
    next(error);
  }
}
