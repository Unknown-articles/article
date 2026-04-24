import { generateKeyPairSync, createHash, createPublicKey } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_DIR       = join(__dirname, '..', 'keys');
const PRIV_PEM_PATH = join(KEY_DIR, 'private.pem');
const PUB_PEM_PATH  = join(KEY_DIR, 'public.pem');
const KID_TXT_PATH  = join(KEY_DIR, 'kid.txt');

let privateKeyPem;
let publicKeyPem;
let keyIdentifier;

function generateKid(pubPem) {
  return createHash('sha256').update(pubPem).digest('hex').slice(0, 16);
}

export function initializeKeys() {
  mkdirSync(KEY_DIR, { recursive: true });

  if (existsSync(PRIV_PEM_PATH) && existsSync(PUB_PEM_PATH)) {
    privateKeyPem  = readFileSync(PRIV_PEM_PATH, 'utf8');
    publicKeyPem   = readFileSync(PUB_PEM_PATH,  'utf8');
    keyIdentifier = existsSync(KID_TXT_PATH)
      ? readFileSync(KID_TXT_PATH, 'utf8').trim()
      : generateKid(publicKeyPem);
    writeFileSync(KID_TXT_PATH, keyIdentifier);
  } else {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKeyPem  = pair.privateKey;
    publicKeyPem   = pair.publicKey;
    keyIdentifier = generateKid(publicKeyPem);
    writeFileSync(PRIV_PEM_PATH, privateKeyPem, { mode: 0o600 });
    writeFileSync(PUB_PEM_PATH,  publicKeyPem);
    writeFileSync(KID_TXT_PATH,  keyIdentifier);
  }

  console.log(`RSA key loaded (kid: ${keyIdentifier})`);
}

export function getPrivKeyPem() {
  return privateKeyPem;
}

export function getKeyIdentifier() {
  return keyIdentifier;
}

export function getJwkSet() {
  const jwk = createPublicKey(publicKeyPem).export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: keyIdentifier,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}
