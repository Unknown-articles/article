import { Router } from 'express';
import { getDiscoveryDocument } from '../controllers/discovery-controller.js';

const router = Router();

router.get('/.well-known/openid-configuration', getDiscoveryDocument);

export default router;
