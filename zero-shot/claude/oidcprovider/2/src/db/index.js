import Database from 'better-sqlite3';
import { DB_PATH } from '../config.js';
import { initSchema } from './schema.js';
import { generateKeyPair, exportJWK, exportPKCS8, exportSPKI } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

let _db;

export function getDb() {
  if (!_db) throw new Error('DB not initialized');
  return _db;
}

export async function initDb() {
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  await seedKeys(_db);
  seedTestData(_db);
  return _db;
}

async function seedKeys(db) {
  const active = db.prepare('SELECT kid FROM keys WHERE active=1').get();
  if (active) return;

  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
  const kid = uuidv4();
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  db.prepare('INSERT INTO keys (kid, public_key, private_key) VALUES (?,?,?)')
    .run(kid, publicPem, privatePem);
}

function seedTestData(db) {
  const client = db.prepare('SELECT client_id FROM clients WHERE client_id=?').get('test-client');
  if (!client) {
    db.prepare('INSERT INTO clients (client_id, client_secret, redirect_uris) VALUES (?,?,?)')
      .run('test-client', 'test-secret',
        JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3001/callback']));
  }

  const user = db.prepare('SELECT id FROM users WHERE username=?').get('testuser');
  if (!user) {
    // Store password as sha256 hex for simplicity
    const hashed = createHash('sha256').update('password123').digest('hex');
    db.prepare('INSERT INTO users (id, username, password, email, name) VALUES (?,?,?,?,?)')
      .run(uuidv4(), 'testuser', hashed, 'testuser@example.com', 'Test User');
  }
}
