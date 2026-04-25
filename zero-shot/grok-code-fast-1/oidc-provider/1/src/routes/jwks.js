import express from 'express';
import { getJWKSHandler } from '../controllers/jwks.js';

const router = express.Router();

router.get('/.well-known/jwks.json', getJWKSHandler);

export default router;