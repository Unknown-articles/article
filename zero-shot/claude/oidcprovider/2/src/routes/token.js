import { Router } from 'express';
import { postToken } from '../controllers/tokenController.js';

const router = Router();

router.post('/oauth2/token', postToken);

export default router;
