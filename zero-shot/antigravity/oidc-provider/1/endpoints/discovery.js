import express from 'express';

const router = express.Router();

router.get('/.well-known/openid-configuration', (req, res) => {
  const issuer = `${req.protocol}://${req.get('host')}`;
  
  const configuration = {
    issuer: issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'name', 'email']
  };

  res.json(configuration);
});

export default router;
