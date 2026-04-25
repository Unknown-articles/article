import { Router } from 'express';
import { getOpenIDConfiguration } from '../controllers/discoveryController.js';
import { getJwks } from '../controllers/jwksController.js';

const router = Router();

router.get('/openid-configuration', getOpenIDConfiguration);
router.get('/jwks.json',            getJwks);

export default router;
