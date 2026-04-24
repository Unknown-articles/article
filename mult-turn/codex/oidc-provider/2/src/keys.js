import { createHash, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const keyStorageDirectory = process.env.KEYS_DIR ?? 'keys';
const signingKeyPath = path.join(keyStorageDirectory, 'private.pem');
const verificationKeyPath = path.join(keyStorageDirectory, 'public.pem');

let currentJwksKey;
let currentPrivateKey;

function encodeBase64Url(rawValue) {
  return Buffer.from(rawValue).toString('base64url');
}

async function doesFileExist(targetPath) {
  try {
    await readFile(targetPath);
    return true;
  } catch (readError) {
    if (readError.code === 'ENOENT') {
      return false;
    }

    throw readError;
  }
}

async function createAndSaveKeyPair() {
  const { privateKey: generatedPrivateKey, publicKey: generatedPublicKey } = generateKeyPairSync(
    'rsa',
    {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    },
  );

  await mkdir(keyStorageDirectory, { recursive: true });
  await writeFile(signingKeyPath, generatedPrivateKey, { mode: 0o600 });
  await writeFile(verificationKeyPath, generatedPublicKey, { mode: 0o644 });

  return { privateKey: generatedPrivateKey, publicKey: generatedPublicKey };
}

export async function prepareKeys() {
  const privateKeyAvailable = await doesFileExist(signingKeyPath);
  const publicKeyAvailable = await doesFileExist(verificationKeyPath);

  const { privateKey, publicKey } =
    privateKeyAvailable && publicKeyAvailable
      ? {
          privateKey: await readFile(signingKeyPath, 'utf8'),
          publicKey: await readFile(verificationKeyPath, 'utf8'),
        }
      : await createAndSaveKeyPair();

  const publicKeyObject = createPublicKey(publicKey);
  const exportedJwk = publicKeyObject.export({ format: 'jwk' });
  const keyId = createHash('sha256')
    .update(publicKeyObject.export({ type: 'spki', format: 'der' }))
    .digest('base64url');

  currentJwksKey = {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: keyId,
    n: encodeBase64Url(Buffer.from(exportedJwk.n, 'base64url')),
    e: encodeBase64Url(Buffer.from(exportedJwk.e, 'base64url')),
  };
  currentPrivateKey = privateKey;
}

export function getJwks() {
  if (!currentJwksKey) {
    throw new Error('Keys have not been initialized');
  }

  return {
    keys: [currentJwksKey],
  };
}

export function getSigningKey() {
  if (!currentJwksKey || !currentPrivateKey) {
    throw new Error('Keys have not been initialized');
  }

  return {
    kid: currentJwksKey.kid,
    privateKey: currentPrivateKey,
  };
}
