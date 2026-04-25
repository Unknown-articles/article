import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'crypto';

export function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomString(bytes = 32) {
  return base64UrlEncode(randomBytes(bytes));
}

export function createCodeChallenge(codeVerifier) {
  return base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64);
  return `${derived.toString('hex')}$${salt}`;
}

export function verifyPassword(password, stored) {
  const [hash, salt] = stored.split('$');
  if (!hash || !salt) {
    return false;
  }
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}
