import * as jose from 'jose';

let keyPair = null;

export async function getKeyPair() {
  if (!keyPair) {
    keyPair = await jose.generateKeyPair('RS256', { extractable: true });
  }
  return keyPair;
}

export async function getJWKS() {
  const { publicKey } = await getKeyPair();
  const jwk = await jose.exportJWK(publicKey);
  // OIDC requires a few fields for JWKS items
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = 'key-1';
  return {
    keys: [jwk]
  };
}
