import express from 'express';
import { getJWK } from '../services/jwt.js';

const router = express.Router();

router.get('/.well-known/jwks.json', (req, res) => {
  const jwk = getJWK();
  res.json({ keys: [jwk] });
});

export default router;