import { Router } from 'express';

const router = Router();

function issuer() {
  return process.env.ISSUER || `http://localhost:${process.env.PORT || 3000}`;
}

router.get('/.well-known/openid-configuration', (req, res) => {
  const base = issuer();
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth2/authorize`,
    token_endpoint: `${base}/oauth2/token`,
    userinfo_endpoint: `${base}/userinfo`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    grant_types_supported: ['authorization_code'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'name'],
  });
});

export default router;
