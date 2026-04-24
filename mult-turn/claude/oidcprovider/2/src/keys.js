import { generateKeyPairSync, createHash, createPublicKey } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIRECTORY = join(__dirname, '..', 'keys');
const PRIVATE_KEY_PEM = join(KEYS_DIRECTORY, 'private.pem');
const PUBLIC_KEY_PEM  = join(KEYS_DIRECTORY, 'public.pem');
const KEY_ID_FILE     = join(KEYS_DIRECTORY, 'kid.txt');

let signingKey;
let verificationKey;
let keyId;

function computeKid(publicPem) {
  return createHash('sha256').update(publicPem).digest('hex').slice(0, 16);
}

export function loadCryptoKeys() {
  mkdirSync(KEYS_DIRECTORY, { recursive: true });

  if (existsSync(PRIVATE_KEY_PEM) && existsSync(PUBLIC_KEY_PEM)) {
    signingKey     = readFileSync(PRIVATE_KEY_PEM, 'utf8');
    verificationKey = readFileSync(PUBLIC_KEY_PEM,  'utf8');
    keyId = existsSync(KEY_ID_FILE)
      ? readFileSync(KEY_ID_FILE, 'utf8').trim()
      : computeKid(verificationKey);
    writeFileSync(KEY_ID_FILE, keyId);
  } else {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    signingKey     = pair.privateKey;
    verificationKey = pair.publicKey;
    keyId = computeKid(verificationKey);
    writeFileSync(PRIVATE_KEY_PEM, signingKey, { mode: 0o600 });
    writeFileSync(PUBLIC_KEY_PEM,  verificationKey);
    writeFileSync(KEY_ID_FILE,     keyId);
  }

  console.log(`RSA key loaded (kid: ${keyId})`);
}

export function getSigningKey() {
  return signingKey;
}

export function getKeyId() {
  return keyId;
}

export function getPublicKeySet() {
  const jwk = createPublicKey(verificationKey).export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: keyId,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}
