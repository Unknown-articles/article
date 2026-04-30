import crypto from 'crypto';

let currentKey = null;

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export const generateRSAKey = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
  const kid = crypto.randomBytes(16).toString('hex');

  currentKey = {
    publicKey,
    privateKey,
    kid,
    jwk: {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: kid,
      n: jwk.n,
      e: jwk.e
    }
  };
};

export const getCurrentKey = () => {
  if (!currentKey) {
    generateRSAKey();
  }
  return currentKey;
};

// Simulate basic key rotation: generates a new key on demand
export const rotateKey = () => {
  generateRSAKey();
};

export const getJwks = () => {
  const key = getCurrentKey();
  return {
    keys: [key.jwk]
  };
};
