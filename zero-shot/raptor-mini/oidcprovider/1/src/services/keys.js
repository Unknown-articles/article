import { generateKeyPairSync, createSign, randomBytes } from 'crypto';
import { base64UrlEncode } from '../utils.js';

const keyStore = [];
let currentKey;

function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001
  });

  const jwk = publicKey.export({ format: 'jwk' });
  const kid = randomBytes(12).toString('hex');

  return {
    kid,
    privateKey,
    publicKey,
    jwk: {
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      kid,
      n: jwk.n,
      e: jwk.e
    }
  };
}

export async function initKeyStore() {
  keyStore.push(generateKeyPair());
  keyStore.push(generateKeyPair());
  currentKey = keyStore[0];
}

export function getCurrentKey() {
  if (!currentKey) {
    throw new Error('Key store not initialized');
  }
  return currentKey;
}

export function getJwks() {
  return { keys: keyStore.map((key) => key.jwk) };
}

export function signJwt(payload, issuer, audience) {
  const key = getCurrentKey();
  const header = { alg: 'RS256', typ: 'JWT', kid: key.kid };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 3600
  };
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(body)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(key.privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
