import { createSign } from 'crypto';
import config from '../config/index.js';

function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function signIdToken(payload, privateKeyPem, kid) {
  const header = { alg: 'RS256', kid };
  const headerB64 = base64urlEncode(header);
  const payloadB64 = base64urlEncode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign({ key: privateKeyPem, format: 'pem', type: 'pkcs8' }, 'base64url');

  return `${signingInput}.${signature}`;
}

export function buildIdTokenPayload(user, clientId, extraClaims = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: String(user.id),
    iss: config.ISSUER,
    aud: clientId,
    exp: now + config.ACCESS_TOKEN_TTL,
    iat: now,
    email: user.email,
    name: user.name,
    ...extraClaims,
  };
}
