import { Router } from 'express';
import { getDiscoveryMetadata } from '../controllers/discovery-controller.js';
import { getJwks } from '../controllers/jwks-controller.js';

const router = Router();

router.get('/openid-configuration', getDiscoveryMetadata);
router.get('/jwks.json', getJwks);

export default router;
