import express from 'express';
import { PORT } from './config.js';
import { initializeDatabase } from './db.js';
import { jsonError } from './errors.js';
import { authorizeRouter } from './routes/authorize.js';
import { discoveryRouter } from './routes/discovery.js';
import { jwksRouter } from './routes/jwks.js';
import { tokenRouter } from './routes/token.js';
import { userinfoRouter } from './routes/userinfo.js';
import { ensureSigningKey } from './services/keys.js';

export function createApp() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(discoveryRouter);
  app.use(jwksRouter);
  app.use(authorizeRouter);
  app.use(tokenRouter);
  app.use(userinfoRouter);

  app.use((req, res) => {
    jsonError(res, 404, 'not_found');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    console.error(error);
    jsonError(res, 500, 'server_error');
  });

  return app;
}

export async function start() {
  await initializeDatabase();
  await ensureSigningKey();
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`OIDC provider listening on http://localhost:${PORT}`);
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  start();
}
