import express from 'express';

const router = express.Router();

router.get('/.well-known/openid-configuration', (req, res) => {
  const issuer = `http://localhost:${process.env.PORT || 4000}`; // In a real app, this should be configurable
  
  res.json({
    issuer: issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"]
  });
});

export default router;
