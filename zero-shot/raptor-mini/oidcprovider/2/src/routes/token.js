import express from 'express';
import { token } from '../controllers/tokenController.js';

const router = express.Router();
router.post('/token', token);
export default router;
