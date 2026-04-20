import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

const kid = crypto.randomBytes(16).toString('hex');

export { publicKey, privateKey, kid };

export function getJWKS() {
  const publicKeyObj = crypto.createPublicKey(publicKey);
  const jwk = publicKeyObj.export({ format: 'jwk' });
  return {
    keys: [{
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid,
      n: jwk.n,
      e: jwk.e
    }]
  };
}