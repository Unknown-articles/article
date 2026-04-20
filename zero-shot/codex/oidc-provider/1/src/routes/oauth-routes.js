import { Router } from 'express';
import { authorize } from '../controllers/authorization-controller.js';
import { issueToken } from '../controllers/token-controller.js';

const router = Router();

router.get('/authorize', authorize);
router.post('/token', issueToken);

export default router;
