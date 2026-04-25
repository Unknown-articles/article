import crypto from 'node:crypto';
import { exportJWK, generateKeyPair, importJWK } from 'jose';
import { all, get, run } from '../db/sqlite.js';

function generateKid() {
  return crypto.randomUUID();
}

async function createSigningKeyRecord(status = 'active') {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const kid = generateKid();

  const publicPayload = {
    ...publicJwk,
    kid,
    use: 'sig',
    alg: 'RS256',
  };

  const privatePayload = {
    ...privateJwk,
    kid,
    use: 'sig',
    alg: 'RS256',
  };

  await run(
    `INSERT INTO signing_keys (kid, public_jwk, private_jwk, status, rotated_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [kid, JSON.stringify(publicPayload), JSON.stringify(privatePayload), status],
  );

  return {
    kid,
    publicJwk: publicPayload,
    privateJwk: privatePayload,
    status,
  };
}

export async function ensureActiveSigningKey() {
  const activeKey = await get(
    `SELECT kid, public_jwk, private_jwk, status
     FROM signing_keys
     WHERE status = 'active'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
  );

  if (activeKey) {
    return {
      kid: activeKey.kid,
      publicJwk: JSON.parse(activeKey.public_jwk),
      privateJwk: JSON.parse(activeKey.private_jwk),
      status: activeKey.status,
    };
  }

  return createSigningKeyRecord();
}

export async function rotateSigningKey() {
  await run(
    `UPDATE signing_keys
     SET status = 'retired', rotated_at = CURRENT_TIMESTAMP
     WHERE status = 'active'`,
  );

  return createSigningKeyRecord('active');
}

export async function listPublicJwks() {
  const rows = await all(
    `SELECT public_jwk
     FROM signing_keys
     WHERE status IN ('active', 'retired')
     ORDER BY created_at DESC, id DESC`,
  );

  return rows.map((row) => JSON.parse(row.public_jwk));
}

export async function getActiveSigningKey() {
  const keyRecord = await ensureActiveSigningKey();

  return {
    ...keyRecord,
    privateKey: await importJWK(keyRecord.privateJwk, 'RS256'),
    publicKey: await importJWK(keyRecord.publicJwk, 'RS256'),
  };
}
