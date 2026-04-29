import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import { randomUUID } from 'crypto';
import { getDb } from '../db/schema.js';

export function ensureActiveKey() {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM jwks WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
  if (existing) return existing;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = randomUUID();
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

  db.prepare(
    'INSERT INTO jwks (kid, private_key, public_key, alg, active) VALUES (?, ?, ?, ?, 1)'
  ).run(kid, privatePem, publicPem, 'RS256');

  return db.prepare('SELECT * FROM jwks WHERE kid = ?').get(kid);
}

export function getAllActiveKeys() {
  return getDb().prepare('SELECT * FROM jwks WHERE active = 1').all();
}

export function getActivePrivateKey() {
  const row = ensureActiveKey();
  return { kid: row.kid, key: createPrivateKey(row.private_key) };
}

function base64urlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function buildJwks() {
  const rows = getAllActiveKeys();
  const keys = rows.map((row) => {
    const pub = createPublicKey(row.public_key);
    const jwk = pub.export({ format: 'jwk' });
    return {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: row.kid,
      n: jwk.n,
      e: jwk.e,
    };
  });
  return { keys };
}
