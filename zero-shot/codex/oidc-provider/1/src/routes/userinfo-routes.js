import { Router } from 'express';
import {
  getUserInfo,
  postUserInfoNotAllowed,
} from '../controllers/userinfo-controller.js';
import { requireBearerToken } from '../middleware/bearer-auth.js';

const router = Router();

router.get('/userinfo', requireBearerToken, getUserInfo);
router.post('/userinfo', postUserInfoNotAllowed);

export default router;
