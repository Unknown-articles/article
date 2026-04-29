import { initDb } from './db/index.js';
import app from './app.js';
import { PORT } from './config.js';

initDb().then(() => {
  app.listen(PORT, () => console.log(`OIDC Provider listening on http://localhost:${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
