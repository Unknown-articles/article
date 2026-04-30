import express from 'express';
import { getJwks } from '../keys.js';

const router = express.Router();

router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJwks());
});

export default router;
