import app from './app.js';
import { initDatabase } from './services/db.js';
import { initKeyStore } from './services/keys.js';
import { PORT, ISSUER_URL } from './config.js';

async function startup() {
  await initDatabase();
  await initKeyStore();

  app.listen(PORT, () => {
    console.log(`OIDC provider listening on http://localhost:${PORT}`);
    console.log(`issuer=${ISSUER_URL}`);
  });
}

startup().catch((error) => {
  console.error('Startup failure:', error);
  process.exit(1);
});
