import crypto from 'node:crypto';
import { get, run, all } from './db.js';
import { base64UrlEncode, encodeJwt, nowSeconds } from './utils.js';

const generateRsaKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001
  });

  const jwk = publicKey.export({ format: 'jwk' });
  return {
    kid: crypto.randomBytes(8).toString('hex'),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    publicJwk: {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: '',
      n: jwk.n,
      e: jwk.e
    }
  };
};

const parseJwk = (row) => ({
  ...JSON.parse(row.public_jwk),
  kid: row.kid
});

export const initKeys = async () => {
  const current = await get('SELECT * FROM jwks WHERE use_current = 1 LIMIT 1');
  if (current) {
    return parseJwk(current);
  }

  const key = generateRsaKeyPair();
  key.publicJwk.kid = key.kid;
  const createdAt = nowSeconds();
  await run(
    'INSERT INTO jwks (kid, private_key_pem, public_jwk, use_current, created_at) VALUES (?, ?, ?, 1, ?)',
    [key.kid, key.privateKeyPem, JSON.stringify(key.publicJwk), createdAt]
  );
  return key.publicJwk;
};

export const getJwks = async () => {
  const rows = await all('SELECT * FROM jwks ORDER BY created_at DESC');
  return rows.map(parseJwk);
};

export const getCurrentSigningKey = async () => {
  const row = await get('SELECT * FROM jwks WHERE use_current = 1 LIMIT 1');
  if (!row) throw new Error('No signing key available');
  return {
    kid: row.kid,
    privateKeyPem: row.private_key_pem,
    publicJwk: parseJwk(row)
  };
};

export const createIdToken = async ({ sub, aud, iss, email, scope }) => {
  const signingKey = await getCurrentSigningKey();
  const now = nowSeconds();
  const payload = {
    iss,
    sub,
    aud,
    exp: now + 3600,
    iat: now
  };

  if (scope && scope.split(' ').includes('email')) {
    payload.email = email;
  }

  const header = {
    alg: 'RS256',
    kid: signingKey.kid,
    typ: 'JWT'
  };

  return encodeJwt(header, payload, signingKey.privateKeyPem);
};
