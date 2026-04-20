import { getJwks } from '../services/keys.js';

export function jwksMetadata(req, res) {
  res.json(getJwks());
}
