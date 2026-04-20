import { getJWKS } from '../utils/keys.js';

export function getJWKSHandler(req, res) {
  res.json(getJWKS());
}