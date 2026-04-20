import { Router } from 'express';
import { exchangeAuthorizationCode } from '../controllers/token-controller.js';

const router = Router();

router.post('/oauth2/token', exchangeAuthorizationCode);

export default router;
