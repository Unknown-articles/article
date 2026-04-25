import { Router } from 'express';
import { rotateJwks } from '../controllers/jwks-controller.js';

const router = Router();

router.post('/keys/rotate', rotateJwks);

export default router;
