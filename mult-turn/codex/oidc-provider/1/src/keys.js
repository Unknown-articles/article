import { createHash, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const keysDirectory = process.env.KEYS_DIR ?? 'keys';
const privateKeyPath = path.join(keysDirectory, 'private.pem');
const publicKeyPath = path.join(keysDirectory, 'public.pem');

let jwksKey;
let signingPrivateKey;

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function generateAndPersistKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  await mkdir(keysDirectory, { recursive: true });
  await writeFile(privateKeyPath, privateKey, { mode: 0o600 });
  await writeFile(publicKeyPath, publicKey, { mode: 0o644 });

  return { privateKey, publicKey };
}

export async function initializeKeys() {
  const hasPrivateKey = await fileExists(privateKeyPath);
  const hasPublicKey = await fileExists(publicKeyPath);

  const { privateKey, publicKey } =
    hasPrivateKey && hasPublicKey
      ? {
          privateKey: await readFile(privateKeyPath, 'utf8'),
          publicKey: await readFile(publicKeyPath, 'utf8'),
        }
      : await generateAndPersistKeyPair();

  const keyObject = createPublicKey(publicKey);
  const publicJwk = keyObject.export({ format: 'jwk' });
  const kid = createHash('sha256')
    .update(keyObject.export({ type: 'spki', format: 'der' }))
    .digest('base64url');

  jwksKey = {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: base64url(Buffer.from(publicJwk.n, 'base64url')),
    e: base64url(Buffer.from(publicJwk.e, 'base64url')),
  };
  signingPrivateKey = privateKey;
}

export function getJwks() {
  if (!jwksKey) {
    throw new Error('Keys have not been initialized');
  }

  return {
    keys: [jwksKey],
  };
}

export function getSigningKey() {
  if (!jwksKey || !signingPrivateKey) {
    throw new Error('Keys have not been initialized');
  }

  return {
    kid: jwksKey.kid,
    privateKey: signingPrivateKey,
  };
}
