import express from 'express';
import { initializeDatabase } from './db.js';
import { initializeKeys, getJwkSet } from './keys.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';

const webApp = express();
const SERVER_PORT = process.env.PORT || 3000;

webApp.use(express.json());

webApp.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

webApp.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJwkSet());
});

webApp.get('/.well-known/openid-configuration', (req, res) => {
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

webApp.use(express.urlencoded({ extended: false }));
webApp.use(authorizeRouter);
webApp.use(tokenRouter);
webApp.use(userinfoRouter);

await initializeDatabase();
initializeKeys();

webApp.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});
