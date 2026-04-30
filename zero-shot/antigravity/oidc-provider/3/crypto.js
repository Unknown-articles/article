import crypto from 'crypto';

let privateKey, publicKey;
let kid = crypto.randomBytes(16).toString('hex');

// Generate an RSA Key Pair
const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

privateKey = crypto.createPrivateKey(priv);
publicKey = crypto.createPublicKey(pub);

export const getPrivateKey = () => privateKey;
export const getPublicKey = () => publicKey;
export const getKid = () => kid;

// Generate JWKS
export const getJwks = () => {
  const jwk = publicKey.export({ format: 'jwk' });
  return {
    keys: [
      {
        kty: jwk.kty,
        use: 'sig',
        alg: 'RS256',
        kid: kid,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
};

export const rotateKeys = () => {
  kid = crypto.randomBytes(16).toString('hex');
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  privateKey = crypto.createPrivateKey(keys.privateKey);
  publicKey = crypto.createPublicKey(keys.publicKey);
};
