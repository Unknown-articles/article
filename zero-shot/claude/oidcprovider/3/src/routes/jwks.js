import { Router } from 'express';
import { buildJwks } from '../lib/keys.js';

const router = Router();

router.get('/.well-known/jwks.json', (req, res) => {
  res.json(buildJwks());
});

export default router;
