import express from 'express';
import { userinfo } from '../controllers/userinfoController.js';

const router = express.Router();
router.get('/userinfo', userinfo);
router.post('/userinfo', (req, res) => res.sendStatus(405));
export default router;
