import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.js';
import { seedDatabase } from './seed.js';
import config from '../config/index.js';

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(config.DB_PATH);
    try { db.exec('PRAGMA journal_mode = WAL'); } catch (_) {}
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(SCHEMA_SQL);
    seedDatabase(db);
  }
  return db;
}

export default { getDb };
