import express from 'express';
import { initDb } from './db.js';
import { initKeys, getJwks } from './keys.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJwks());
});

app.get('/.well-known/openid-configuration', (req, res) => {
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

app.use(express.urlencoded({ extended: false }));
app.use(authorizeRouter);
app.use(tokenRouter);
app.use(userinfoRouter);

await initDb();
initKeys();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
