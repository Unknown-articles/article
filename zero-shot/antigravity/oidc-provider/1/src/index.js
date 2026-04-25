import { initDb } from './db/index.js';
import { initKeys } from './config/keys.js';
import app from './server.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    initKeys();
    console.log('RSA Keys generated.');

    await initDb();
    console.log('Database initialized and seeded.');

    app.listen(PORT, () => {
      console.log(`OIDC Provider running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
