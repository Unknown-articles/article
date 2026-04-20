import { generateKeyPairSync, createHash, createPublicKey } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, '..', 'keys');
const PRIVATE_PEM = join(KEYS_DIR, 'private.pem');
const PUBLIC_PEM  = join(KEYS_DIR, 'public.pem');
const KID_FILE    = join(KEYS_DIR, 'kid.txt');

let privateKey;
let publicKey;
let kid;

function deriveKid(publicPem) {
  return createHash('sha256').update(publicPem).digest('hex').slice(0, 16);
}

export function initKeys() {
  mkdirSync(KEYS_DIR, { recursive: true });

  if (existsSync(PRIVATE_PEM) && existsSync(PUBLIC_PEM)) {
    privateKey = readFileSync(PRIVATE_PEM, 'utf8');
    publicKey  = readFileSync(PUBLIC_PEM,  'utf8');
    kid = existsSync(KID_FILE)
      ? readFileSync(KID_FILE, 'utf8').trim()
      : deriveKid(publicKey);
    writeFileSync(KID_FILE, kid);
  } else {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = pair.privateKey;
    publicKey  = pair.publicKey;
    kid = deriveKid(publicKey);
    writeFileSync(PRIVATE_PEM, privateKey, { mode: 0o600 });
    writeFileSync(PUBLIC_PEM,  publicKey);
    writeFileSync(KID_FILE,    kid);
  }

  console.log(`RSA key loaded (kid: ${kid})`);
}

export function getPrivateKey() {
  return privateKey;
}

export function getKid() {
  return kid;
}

export function getJwks() {
  const jwk = createPublicKey(publicKey).export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}
