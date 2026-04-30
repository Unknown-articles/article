import crypto from 'crypto';

// Generate RSA key pair for signing tokens
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

// Create kid (Key ID)
const kid = crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').substring(0, 8);

// Generate JWK format for public key
const jwk = publicKey.export({ format: 'jwk' });

export const getPrivateKey = () => privateKey;
export const getPublicKey = () => publicKey;
export const getKeyId = () => kid;

export const getJwks = () => {
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: kid,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
};
