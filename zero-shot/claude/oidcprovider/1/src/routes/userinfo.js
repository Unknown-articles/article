import { Router } from 'express';
import { getUserInfo } from '../controllers/userinfoController.js';

const router = Router();

router.get('/userinfo', getUserInfo);
router.post('/userinfo', getUserInfo);

export default router;
