import crypto from 'node:crypto';

export function createRandomToken(size = 32) {
  return crypto.randomBytes(size).toString('base64url');
}

export function sha256Base64Url(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}
