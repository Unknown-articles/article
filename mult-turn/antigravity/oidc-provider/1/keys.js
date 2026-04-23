import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, 'keys');
const privateKeyPath = join(keysDir, 'private.pem');
const publicKeyPath = join(keysDir, 'public.pem');

let privateKey;
let publicKey;
let kid;

export async function initKeys() {
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    const privPem = await fs.readFile(privateKeyPath, 'utf8');
    const pubPem = await fs.readFile(publicKeyPath, 'utf8');
    privateKey = crypto.createPrivateKey(privPem);
    publicKey = crypto.createPublicKey(pubPem);
  } else {
    // Generate new keys
    const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    privateKey = priv;
    publicKey = pub;

    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' });

    await fs.writeFile(privateKeyPath, privPem);
    await fs.writeFile(publicKeyPath, pubPem);
  }

  // Derive kid by hashing the public key (SPKI format)
  const pubSpki = publicKey.export({ type: 'spki', format: 'der' });
  kid = crypto.createHash('sha256').update(pubSpki).digest('base64url');
}

export function getJwks() {
  const jwk = publicKey.export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
}

export function getPrivateKey() {
  return privateKey;
}

export function getPublicKey() {
  return publicKey;
}

export function getKid() {
  return kid;
}
