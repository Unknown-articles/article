import { getConfig } from './config/env.js';
import { openDatabase } from './database/db.js';
import { initializeSchema } from './database/schema.js';
import { seedDatabase } from './database/seed.js';
import { createApp } from './app.js';
import { ensureSigningKeys } from './services/key-service.js';

export async function bootstrap(overrides = {}) {
  const config = {
    ...getConfig(),
    ...overrides,
  };

  const database = await openDatabase(config.databaseFile);
  await initializeSchema(database);
  await seedDatabase(database);
  await ensureSigningKeys(database);

  return {
    app: createApp({ config, database }),
    config,
    database,
  };
}
