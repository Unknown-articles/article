import crypto from 'node:crypto';

export function randomToken(size = 32) {
  return crypto.randomBytes(size).toString('base64url');
}
