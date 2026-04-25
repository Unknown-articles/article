import { getAllActiveKeys, pemToJwk } from '../keys/keyManager.js';

export function getJwks(req, res) {
  const keys = getAllActiveKeys();
  const jwks = keys.map(k => pemToJwk(k.public_key_pem, k.kid));
  res.json({ keys: jwks });
}
