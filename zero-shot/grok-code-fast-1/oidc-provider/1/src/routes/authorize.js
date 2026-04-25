import express from 'express';
import { getAuthorize, postAuthorize } from '../controllers/authorize.js';

const router = express.Router();

router.get('/oauth2/authorize', getAuthorize);
router.post('/oauth2/authorize', postAuthorize);

export default router;