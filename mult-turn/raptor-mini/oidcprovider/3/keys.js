import { createHash, generateKeyPairSync, createPublicKey } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, 'keys');
const privateKeyPath = join(keysDir, 'private.pem');
const publicKeyPath = join(keysDir, 'public.pem');

mkdirSync(keysDir, { recursive: true });

const toBase64Url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const computeKid = (publicKeyPem) => {
  const hash = createHash('sha256').update(publicKeyPem).digest();
  return toBase64Url(hash);
};

const createKeySet = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });
  return { privateKey, publicKey };
};

const readExistingKeys = () => {
  const privateKey = readFileSync(privateKeyPath, 'utf8');
  const publicKey = readFileSync(publicKeyPath, 'utf8');
  return { privateKey, publicKey };
};

export function prepareSigningKeys() {
  const keysExist = existsSync(privateKeyPath) && existsSync(publicKeyPath);
  const { privateKey, publicKey } = keysExist ? readExistingKeys() : createKeySet();

  const keyObject = createPublicKey(publicKey);
  const jwk = keyObject.export({ format: 'jwk' });
  const kid = computeKid(publicKey);

  return {
    privateKey,
    publicKey,
    kid,
    jwks: {
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
    },
  };
}
