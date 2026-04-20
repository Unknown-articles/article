import express from 'express';
import { getUserInfo } from '../controllers/userinfo.js';

const router = express.Router();

router.get('/userinfo', getUserInfo);
router.post('/userinfo', (req, res) => res.status(405).end());

export default router;