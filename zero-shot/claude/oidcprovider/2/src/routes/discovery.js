import { Router } from 'express';
import { getDiscovery } from '../controllers/discoveryController.js';
import { getJwks } from '../controllers/jwksController.js';

const router = Router();

router.get('/.well-known/openid-configuration', getDiscovery);
router.get('/.well-known/jwks.json', getJwks);

export default router;
