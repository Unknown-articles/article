import { findAuthorizationCode } from '../services/authorization-service.js';
import {
  authenticateClient,
  extractClientCredentials,
  issueTokens,
  markAuthorizationCodeConsumed,
  validatePkce,
  validateTokenRequestShape,
} from '../services/token-service.js';

export async function exchangeAuthorizationCode(req, res) {
  const validationError = validateTokenRequestShape(req.body);

  if (validationError) {
    res.status(validationError.status).json({
      error: validationError.error,
      error_description: validationError.message,
    });
    return;
  }

  const { clientId, clientSecret } = extractClientCredentials(req);
  const client = await authenticateClient(clientId, clientSecret);

  if (!client) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication failed.',
    });
    return;
  }

  const authCode = await findAuthorizationCode(req.body.code);
  const now = Date.now();

  if (
    !authCode ||
    authCode.client_identifier !== client.client_id ||
    authCode.redirect_uri !== req.body.redirect_uri ||
    authCode.consumed_at ||
    new Date(authCode.expires_at).getTime() <= now
  ) {
    res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code validation failed.',
    });
    return;
  }

  if (!validatePkce(authCode, req.body.code_verifier)) {
    res.status(400).json({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed.',
    });
    return;
  }

  await markAuthorizationCodeConsumed(authCode.id);
  const tokens = await issueTokens({ client, authCode });

  res.set('Cache-Control', 'no-store');
  res.json(tokens);
}
