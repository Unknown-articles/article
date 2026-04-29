import { importPKCS8, importSPKI, exportJWK } from 'jose';
import { getDb } from './db/index.js';

export function getActiveKeyRow() {
  return getDb().prepare('SELECT * FROM keys WHERE active=1 ORDER BY created_at DESC LIMIT 1').get();
}

export async function getSigningKey() {
  const row = getActiveKeyRow();
  return importPKCS8(row.private_key, 'RS256');
}

export async function getJwks() {
  const rows = getDb().prepare('SELECT kid, public_key FROM keys WHERE active=1').all();
  const keys = await Promise.all(rows.map(async (row) => {
    const pub = await importSPKI(row.public_key, 'RS256');
    const jwk = await exportJWK(pub);
    return { kty: 'RSA', use: 'sig', alg: 'RS256', kid: row.kid, n: jwk.n, e: jwk.e };
  }));
  return { keys };
}
