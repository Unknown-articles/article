import express from 'express';
import { initDb } from './db/schema.js';
import { ensureActiveKey } from './lib/keys.js';
import discoveryRouter from './routes/discovery.js';
import jwksRouter from './routes/jwks.js';
import authorizeRouter from './routes/authorize.js';
import tokenRouter from './routes/token.js';
import userinfoRouter from './routes/userinfo.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(discoveryRouter);
app.use(jwksRouter);
app.use(authorizeRouter);
app.use(tokenRouter);
app.use(userinfoRouter);

const PORT = process.env.PORT || 3000;

initDb();
ensureActiveKey();

app.listen(PORT, () => {
  console.log(`OIDC Provider running on http://localhost:${PORT}`);
});

export default app;
