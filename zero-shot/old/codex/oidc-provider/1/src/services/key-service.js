import { decodeProtectedHeader, exportJWK, generateKeyPair, importJWK } from 'jose';
import { all, get, run, withTransaction } from '../database/db.js';

const ACTIVE_STATUS = 'active';
const RETIRED_STATUS = 'retired';

export async function ensureSigningKeys(database) {
  const activeKey = await getActiveSigningKey(database);
  if (activeKey) {
    return activeKey;
  }

  return rotateSigningKeys(database);
}

export async function getActiveSigningKey(database) {
  const row = await get(
    database,
    'SELECT kid, public_jwk, private_jwk, status, created_at, activated_at FROM signing_keys WHERE status = ? ORDER BY activated_at DESC LIMIT 1',
    [ACTIVE_STATUS],
  );

  return row ? hydrateSigningKey(row) : null;
}

export async function getPublicJwks(database) {
  const rows = await all(
    database,
    'SELECT kid, public_jwk, private_jwk, status, created_at, activated_at FROM signing_keys WHERE status IN (?, ?) ORDER BY activated_at DESC',
    [ACTIVE_STATUS, RETIRED_STATUS],
  );

  return {
    keys: rows.map((row) => JSON.parse(row.public_jwk)),
  };
}

export async function rotateSigningKeys(database) {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = await exportJWK(keyPair.publicKey);
  const privateJwk = await exportJWK(keyPair.privateKey);
  const kid = crypto.randomUUID();
  const activatedAt = new Date().toISOString();

  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  publicJwk.kid = kid;

  privateJwk.use = 'sig';
  privateJwk.alg = 'RS256';
  privateJwk.kid = kid;

  await withTransaction(database, async () => {
    await run(database, 'UPDATE signing_keys SET status = ? WHERE status = ?', [RETIRED_STATUS, ACTIVE_STATUS]);
    await run(
      database,
      `
        INSERT INTO signing_keys (kid, public_jwk, private_jwk, status, activated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [kid, JSON.stringify(publicJwk), JSON.stringify(privateJwk), ACTIVE_STATUS, activatedAt],
    );
  });

  return {
    kid,
    publicJwk,
    privateJwk,
    publicKey: await importJWK(publicJwk, 'RS256'),
    privateKey: await importJWK(privateJwk, 'RS256'),
  };
}

export async function getActivePrivateKey(database) {
  const activeKey = await getActiveSigningKey(database);
  if (!activeKey) {
    return null;
  }

  return {
    kid: activeKey.kid,
    privateKey: await importJWK(activeKey.privateJwk, 'RS256'),
    publicKey: await importJWK(activeKey.publicJwk, 'RS256'),
  };
}

export async function getPublicKeyForToken(database, token) {
  const { kid } = decodeProtectedHeader(token);
  if (!kid) {
    return null;
  }

  const row = await get(
    database,
    'SELECT public_jwk FROM signing_keys WHERE kid = ? AND status IN (?, ?)',
    [kid, ACTIVE_STATUS, RETIRED_STATUS],
  );

  if (!row) {
    return null;
  }

  return {
    kid,
    publicKey: await importJWK(JSON.parse(row.public_jwk), 'RS256'),
  };
}

function hydrateSigningKey(row) {
  return {
    kid: row.kid,
    publicJwk: JSON.parse(row.public_jwk),
    privateJwk: JSON.parse(row.private_jwk),
    status: row.status,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
  };
}
