import { createApp } from './app.js';
import { config } from './config/index.js';
import { initializeDatabase } from './db/init.js';

const app = createApp();

await initializeDatabase();

app.listen(config.port, () => {
  console.log(`OIDC provider listening on port ${config.port}`);
});
