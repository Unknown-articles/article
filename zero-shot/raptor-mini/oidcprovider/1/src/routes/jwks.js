import express from 'express';
import { jwksMetadata } from '../controllers/jwksController.js';

const router = express.Router();
router.get('/jwks.json', jwksMetadata);
export default router;
