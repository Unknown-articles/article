import crypto from 'crypto';
import { exportJWK, SignJWT, generateKeyPair, jwtVerify } from 'jose';

const keys = [];

async function generateRsaKey() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const kid = crypto.randomUUID();

  return {
    kid,
    publicJwk: { ...publicJwk, alg: 'RS256', use: 'sig', kty: 'RSA', kid },
    privateJwk,
    privateKey,
  };
}

export async function initKeys() {
  if (keys.length === 0) {
    const key = await generateRsaKey();
    keys.push(key);
  }
}

export async function rotateKeys() {
  const nextKey = await generateRsaKey();
  keys.push(nextKey);
  return nextKey;
}

export function getCurrentKey() {
  return keys[keys.length - 1];
}

export function getJWKS() {
  return { keys: keys.map((key) => key.publicJwk) };
}

export async function signIdToken(payload, clientId, issuer) {
  const key = getCurrentKey();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, aud: clientId, iss: issuer, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid })
    .sign(key.privateKey);
}

export async function verifyIdToken(token) {
  const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  const key = keys.find((item) => item.kid === decoded.kid);
  if (!key) {
    throw new Error('Unknown key ID');
  }
  return jwtVerify(token, key.privateKey, {
    algorithms: ['RS256'],
  });
}
