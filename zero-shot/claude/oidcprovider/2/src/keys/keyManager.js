import { generateKeyPairSync, createPublicKey, randomBytes } from 'crypto';
import { getDb } from '../db/index.js';

function generateKid() {
  return randomBytes(16).toString('hex');
}

function generateRsaKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

export function ensureActiveKey() {
  const db = getDb();
  let activeKey = db.prepare('SELECT * FROM signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1').get();
  if (!activeKey) {
    const kid = generateKid();
    const { privateKey, publicKey } = generateRsaKeyPair();
    db.prepare(`
      INSERT INTO signing_keys (kid, private_key_pem, public_key_pem, active)
      VALUES (?, ?, ?, 1)
    `).run(kid, privateKey, publicKey);
    activeKey = db.prepare('SELECT * FROM signing_keys WHERE kid = ?').get(kid);
  }
  return activeKey;
}

export function getActiveKey() {
  return ensureActiveKey();
}

export function getAllActiveKeys() {
  const db = getDb();
  return db.prepare('SELECT * FROM signing_keys WHERE active = 1').all();
}

export function rotateKey() {
  const db = getDb();
  db.prepare('UPDATE signing_keys SET active = 0').run();
  return ensureActiveKey();
}

export function pemToJwk(publicKeyPem, kid) {
  const key = createPublicKey(publicKeyPem);
  const jwk = key.export({ format: 'jwk' });
  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: jwk.n,
    e: jwk.e,
  };
}
