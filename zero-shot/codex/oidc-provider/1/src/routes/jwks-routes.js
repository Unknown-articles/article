import { Router } from 'express';
import { getJwks } from '../controllers/jwks-controller.js';

const router = Router();

router.get('/.well-known/jwks.json', getJwks);

export default router;
