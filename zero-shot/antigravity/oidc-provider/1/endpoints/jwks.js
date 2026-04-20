import express from 'express';
import { getJWKS } from '../utils/keystore.js';

const router = express.Router();

router.get('/.well-known/jwks.json', async (req, res) => {
  try {
    const jwks = await getJWKS();
    res.json(jwks);
  } catch (err) {
    console.error('Failed to generate JWKS:', err);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
