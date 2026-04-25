import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'chat.db');

const db = new sqlite3.Database(dbPath);

const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');

db.serialize(() => {
  db.exec(initSQL, (err) => {
    if (err) {
      console.error('Error initializing database:', err);
    } else {
      console.log('Database initialized');
    }
  });
});

export default db;