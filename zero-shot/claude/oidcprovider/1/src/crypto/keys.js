import crypto from 'crypto';
import { importPKCS8, importSPKI, exportJWK } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

/**
 * Retrieve the currently active signing key, generating one if none exists.
 */
export async function getActiveSigningKey() {
  const db = getDb();
  let record = db
    .prepare('SELECT * FROM signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1')
    .get();

  if (!record) {
    record = generateAndStoreKey();
  }

  const privateKey = await importPKCS8(record.private_key, 'RS256');
  const publicKey  = await importSPKI(record.public_key,  'RS256');

  return { id: record.id, privateKey, publicKey, algorithm: record.algorithm };
}

/**
 * Return all active public keys as a JWKS object.
 */
export async function getAllPublicKeys() {
  const db = getDb();
  const records = db.prepare('SELECT * FROM signing_keys WHERE active = 1').all();

  const keys = await Promise.all(
    records.map(async (record) => {
      const publicKey = await importSPKI(record.public_key, 'RS256');
      const jwk = await exportJWK(publicKey);
      return { ...jwk, kid: record.id, use: 'sig', alg: record.algorithm };
    })
  );

  return { keys };
}

/**
 * Deactivate all current keys and generate a fresh RSA key pair.
 * Existing tokens signed with old keys remain verifiable until they expire.
 */
export function rotateKeys() {
  const db = getDb();
  db.prepare('UPDATE signing_keys SET active = 0').run();
  const record = generateAndStoreKey();
  console.log(`Key rotated. New active key id: ${record.id}`);
  return record;
}

function generateAndStoreKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO signing_keys (id, private_key, public_key, algorithm, active)
    VALUES (?, ?, ?, 'RS256', 1)
  `).run(id, privateKey, publicKey);

  console.log(`Generated new RSA-2048 signing key: ${id}`);
  return db.prepare('SELECT * FROM signing_keys WHERE id = ?').get(id);
}
