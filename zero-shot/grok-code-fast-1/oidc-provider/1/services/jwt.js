import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateKeyPath = path.join(__dirname, '../keys/private.pem');
const publicKeyPath = path.join(__dirname, '../keys/public.pem');

let privateKey;
let publicKey;

try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  publicKey = fs.readFileSync(publicKeyPath, 'utf8');
} catch (err) {
  throw new Error('RSA keys not found. Run npm run generate-keys first.');
}

export function signIdToken(payload) {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

export function verifyToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

export function getJWK() {
  const key = crypto.createPublicKey(publicKey);
  const jwk = key.export({ format: 'jwk' });
  return {
    kty: jwk.kty,
    use: 'sig',
    kid: 'rsa-key-1',
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256'
  };
}

export function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

export function hashPKCE(verifier, method = 'S256') {
  if (method === 'S256') {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }
  return verifier; // plain
}