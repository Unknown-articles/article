import { Router } from 'express';
import { getJwkPublic } from '../config/keys.js';

const router = Router();

router.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth2/authorize`,
    token_endpoint: `${baseUrl}/oauth2/token`,
    userinfo_endpoint: `${baseUrl}/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256']
  });
});

router.get('/.well-known/jwks.json', (req, res) => {
  const jwk = getJwkPublic();
  res.json({ keys: [jwk] });
});

export default router;
