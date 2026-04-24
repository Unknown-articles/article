import express from 'express';
import { setupDatabase } from './db.js';
import { loadCryptoKeys, getPublicKeySet } from './keys.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';

const server = express();
const HTTP_PORT = process.env.PORT || 3000;

server.use(express.json());

server.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

server.get('/.well-known/jwks.json', (req, res) => {
  res.json(getPublicKeySet());
});

server.get('/.well-known/openid-configuration', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer:                                 base,
    authorization_endpoint:                 `${base}/oauth2/authorize`,
    token_endpoint:                         `${base}/oauth2/token`,
    userinfo_endpoint:                      `${base}/userinfo`,
    jwks_uri:                               `${base}/.well-known/jwks.json`,
    response_types_supported:              ['code'],
    subject_types_supported:               ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
});

server.use(express.urlencoded({ extended: false }));
server.use(authorizeRouter);
server.use(tokenRouter);
server.use(userinfoRouter);

await setupDatabase();
loadCryptoKeys();

server.listen(HTTP_PORT, () => {
  console.log(`Server listening on port ${HTTP_PORT}`);
});
