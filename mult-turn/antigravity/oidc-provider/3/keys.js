import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDirectory = join(__dirname, 'keys');
const privKeyFile = join(keysDirectory, 'private.pem');
const pubKeyFile = join(keysDirectory, 'public.pem');

let rsaPrivKey;
let rsaPubKey;
let keyIdentifier;

export async function prepareKeyMaterial() {
  if (!existsSync(keysDirectory)) {
    mkdirSync(keysDirectory, { recursive: true });
  }

  if (existsSync(privKeyFile) && existsSync(pubKeyFile)) {
    const privPem = await fs.readFile(privKeyFile, 'utf8');
    const pubPem = await fs.readFile(pubKeyFile, 'utf8');
    rsaPrivKey = crypto.createPrivateKey(privPem);
    rsaPubKey = crypto.createPublicKey(pubPem);
  } else {
    // Generate new keys
    const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    rsaPrivKey = priv;
    rsaPubKey = pub;

    const privPem = rsaPrivKey.export({ type: 'pkcs8', format: 'pem' });
    const pubPem = rsaPubKey.export({ type: 'spki', format: 'pem' });

    await fs.writeFile(privKeyFile, privPem);
    await fs.writeFile(pubKeyFile, pubPem);
  }

  // Derive keyIdentifier by hashing the public key (SPKI format)
  const pubSpki = rsaPubKey.export({ type: 'spki', format: 'der' });
  keyIdentifier = crypto.createHash('sha256').update(pubSpki).digest('base64url');
}

export function getJwkSet() {
  const jwk = rsaPubKey.export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: keyIdentifier,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
}

export function getSigningKey() {
  return rsaPrivKey;
}

export function getVerificationKey() {
  return rsaPubKey;
}

export function getKeyIdentifier() {
  return keyIdentifier;
}
