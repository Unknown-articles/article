import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, importJWK } from 'jose';
import { all, get, run } from '../db.js';

export async function ensureSigningKey() {
  const activeKey = await get('SELECT * FROM signing_keys WHERE active = 1 ORDER BY created_at DESC LIMIT 1');
  if (activeKey) {
    return activeKey;
  }
  return rotateSigningKey();
}

export async function rotateSigningKey() {
  const kid = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  const now = Math.floor(Date.now() / 1000);

  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  privateJwk.kid = kid;
  privateJwk.use = 'sig';
  privateJwk.alg = 'RS256';

  await run('UPDATE signing_keys SET active = 0 WHERE active = 1');
  await run(
    'INSERT INTO signing_keys (kid, private_jwk, public_jwk, active, created_at) VALUES (?, ?, ?, 1, ?)',
    [kid, JSON.stringify(privateJwk), JSON.stringify(publicJwk), now]
  );

  return get('SELECT * FROM signing_keys WHERE kid = ?', [kid]);
}

export async function getPublicJwks() {
  await ensureSigningKey();
  const keys = await all('SELECT public_jwk FROM signing_keys ORDER BY active DESC, created_at DESC');
  return {
    keys: keys.map((row) => JSON.parse(row.public_jwk))
  };
}

export async function getActivePrivateKey() {
  const row = await ensureSigningKey();
  const jwk = JSON.parse(row.private_jwk);
  const key = await importJWK(jwk, 'RS256');
  return { kid: row.kid, key };
}
