import { createHash, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pemDirectory = process.env.KEYS_DIR ?? 'keys';
const privatePemFile = path.join(pemDirectory, 'private.pem');
const publicPemFile = path.join(pemDirectory, 'public.pem');

let cachedJwksEntry;
let cachedPrivatePem;

function toBase64Url(sourceBuffer) {
  return Buffer.from(sourceBuffer).toString('base64url');
}

async function isReadable(fileLocation) {
  try {
    await readFile(fileLocation);
    return true;
  } catch (failure) {
    if (failure.code === 'ENOENT') {
      return false;
    }

    throw failure;
  }
}

async function provisionKeyMaterial() {
  const { privateKey: pemPrivateKey, publicKey: pemPublicKey } = generateKeyPairSync('rsa', {
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

  await mkdir(pemDirectory, { recursive: true });
  await writeFile(privatePemFile, pemPrivateKey, { mode: 0o600 });
  await writeFile(publicPemFile, pemPublicKey, { mode: 0o644 });

  return { privateKey: pemPrivateKey, publicKey: pemPublicKey };
}

export async function warmUpKeys() {
  const privatePemExists = await isReadable(privatePemFile);
  const publicPemExists = await isReadable(publicPemFile);

  const { privateKey, publicKey } =
    privatePemExists && publicPemExists
      ? {
          privateKey: await readFile(privatePemFile, 'utf8'),
          publicKey: await readFile(publicPemFile, 'utf8'),
        }
      : await provisionKeyMaterial();

  const publicPemObject = createPublicKey(publicKey);
  const jwkPayload = publicPemObject.export({ format: 'jwk' });
  const kid = createHash('sha256')
    .update(publicPemObject.export({ type: 'spki', format: 'der' }))
    .digest('base64url');

  cachedJwksEntry = {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: toBase64Url(Buffer.from(jwkPayload.n, 'base64url')),
    e: toBase64Url(Buffer.from(jwkPayload.e, 'base64url')),
  };
  cachedPrivatePem = privateKey;
}

export function getJwks() {
  if (!cachedJwksEntry) {
    throw new Error('Keys have not been initialized');
  }

  return {
    keys: [cachedJwksEntry],
  };
}

export function getSigningKey() {
  if (!cachedJwksEntry || !cachedPrivatePem) {
    throw new Error('Keys have not been initialized');
  }

  return {
    kid: cachedJwksEntry.kid,
    privateKey: cachedPrivatePem,
  };
}
