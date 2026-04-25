import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

let db;

export function getDb() {
  if (!db) {
    const dbPath = path.resolve(config.dbPath);
    const dbDir  = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}
