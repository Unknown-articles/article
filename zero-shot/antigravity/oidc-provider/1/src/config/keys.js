import crypto from 'crypto';

let privateKey, publicKey, jwkPublic;

export const initKeys = () => {
  const { privateKey: prk, publicKey: puk } = crypto.generateKeyPairSync('rsa', {
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

  privateKey = prk;
  publicKey = puk;

  const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
  jwkPublic = {
    ...jwk,
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: 'key-1'
  };
};

export const getPrivateKey = () => privateKey;
export const getPublicKey = () => publicKey;
export const getJwkPublic = () => jwkPublic;
