import { Router } from 'express';
import { getAuthorize, postAuthorize } from '../controllers/authorizationController.js';

const router = Router();

router.get('/oauth2/authorize', getAuthorize);
router.post('/oauth2/authorize', postAuthorize);

export default router;
