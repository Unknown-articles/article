import { ISSUER_URL, RESPONSE_TYPES_SUPPORTED, SUBJECT_TYPES_SUPPORTED, ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED } from '../config.js';

export function discoveryMetadata(req, res) {
  const issuer = ISSUER_URL;
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: RESPONSE_TYPES_SUPPORTED,
    subject_types_supported: SUBJECT_TYPES_SUPPORTED,
    id_token_signing_alg_values_supported: ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED
  });
}
