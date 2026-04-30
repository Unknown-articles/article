import crypto from 'node:crypto';

export const base64UrlEncode = (buffer) => {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

export const randomString = (size = 32) => crypto.randomBytes(size).toString('base64url');

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const encodeJwt = (header, payload, privateKey) => {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
};
