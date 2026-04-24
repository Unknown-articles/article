import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyFolder = join(__dirname, 'keys');
const signKeyPath = join(keyFolder, 'private.pem');
const verifyKeyPath = join(keyFolder, 'public.pem');

let signingKey;
let verificationKey;
let keyId;

export async function loadKeyPair() {
  if (!existsSync(keyFolder)) {
    mkdirSync(keyFolder, { recursive: true });
  }

  if (existsSync(signKeyPath) && existsSync(verifyKeyPath)) {
    const privPem = await fs.readFile(signKeyPath, 'utf8');
    const pubPem = await fs.readFile(verifyKeyPath, 'utf8');
    signingKey = crypto.createPrivateKey(privPem);
    verificationKey = crypto.createPublicKey(pubPem);
  } else {
    // Generate new keys
    const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    signingKey = priv;
    verificationKey = pub;

    const privPem = signingKey.export({ type: 'pkcs8', format: 'pem' });
    const pubPem = verificationKey.export({ type: 'spki', format: 'pem' });

    await fs.writeFile(signKeyPath, privPem);
    await fs.writeFile(verifyKeyPath, pubPem);
  }

  // Derive keyId by hashing the public key (SPKI format)
  const pubSpki = verificationKey.export({ type: 'spki', format: 'der' });
  keyId = crypto.createHash('sha256').update(pubSpki).digest('base64url');
}

export function getKeySet() {
  const jwk = verificationKey.export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: keyId,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
}

export function getSignKey() {
  return signingKey;
}

export function getVerifyKey() {
  return verificationKey;
}

export function getKeyId() {
  return keyId;
}
