import { Router } from 'express';
import { requireBearerToken } from '../middleware/auth.js';
import { getUserInfo } from '../controllers/userinfoController.js';

const router = Router();

// Both GET and POST are permitted by the OIDC Core spec
router.get( '/userinfo', requireBearerToken, getUserInfo);
router.post('/userinfo', requireBearerToken, getUserInfo);

export default router;
