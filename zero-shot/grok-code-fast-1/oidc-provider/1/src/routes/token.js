import express from 'express';
import { postToken } from '../controllers/token.js';

const router = express.Router();

router.post('/oauth2/token', postToken);

export default router;