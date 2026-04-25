import express from 'express';
import { authorizeGet, authorizePost } from '../controllers/authorizeController.js';

const router = express.Router();
router.get('/authorize', authorizeGet);
router.post('/authorize', authorizePost);
export default router;
