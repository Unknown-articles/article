import { Router } from 'express';
import { getUserInfo } from '../controllers/userinfo-controller.js';
import { authenticateBearer } from '../middleware/authenticate-bearer.js';

const router = Router();

router.get('/', authenticateBearer, getUserInfo);

export default router;
