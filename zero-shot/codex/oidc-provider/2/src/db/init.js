import { schemaStatements } from './schema.js';
import { run } from './sqlite.js';
import { seedDatabase } from './seed.js';
import { ensureActiveSigningKey } from '../services/key-service.js';

export async function initializeDatabase() {
  await run('PRAGMA foreign_keys = ON');

  for (const statement of schemaStatements) {
    await run(statement);
  }

  await seedDatabase();
  await ensureActiveSigningKey();
}
