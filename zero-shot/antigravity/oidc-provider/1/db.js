import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function initDb() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      code TEXT PRIMARY KEY,
      client_id TEXT,
      redirect_uri TEXT,
      user_id TEXT,
      nonce TEXT,
      expires_at INTEGER
    )
  `);

  return db;
}

const dbPromise = initDb();

export default dbPromise;
