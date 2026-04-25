import config from '../config/index.js';

export function getOpenIDConfiguration(_req, res) {
  const { issuer } = config;

  res.json({
    issuer,
    authorization_endpoint:                     `${issuer}/oauth2/authorize`,
    token_endpoint:                             `${issuer}/oauth2/token`,
    userinfo_endpoint:                          `${issuer}/userinfo`,
    jwks_uri:                                   `${issuer}/.well-known/jwks.json`,
    response_types_supported:                   ['code'],
    subject_types_supported:                    ['public'],
    id_token_signing_alg_values_supported:      ['RS256'],
    scopes_supported:                           ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported:      ['client_secret_post', 'client_secret_basic'],
    grant_types_supported:                      ['authorization_code'],
    code_challenge_methods_supported:           ['S256', 'plain'],
    claims_supported:                           ['sub', 'iss', 'aud', 'exp', 'iat', 'jti',
                                                 'email', 'name', 'preferred_username'],
    request_parameter_supported:                false,
    request_uri_parameter_supported:            false,
  });
}
