import { Router } from 'express';
import {
  authorizeUser,
  getAuthorizationPage,
} from '../controllers/authorization-controller.js';

const router = Router();

router.get('/oauth2/authorize', getAuthorizationPage);
router.post('/oauth2/authorize', authorizeUser);

export default router;
