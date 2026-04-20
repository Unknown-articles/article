import express from 'express';

const router = express.Router();

const metadata = {
  issuer: 'http://localhost:3000',
  authorization_endpoint: 'http://localhost:3000/oauth2/authorize',
  token_endpoint: 'http://localhost:3000/oauth2/token',
  userinfo_endpoint: 'http://localhost:3000/userinfo',
  jwks_uri: 'http://localhost:3000/.well-known/jwks.json',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256']
};

router.get('/.well-known/openid-configuration', (req, res) => {
  res.json(metadata);
});

export default router;