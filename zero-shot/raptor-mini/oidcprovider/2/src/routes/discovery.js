import express from 'express';
import { discoveryMetadata } from '../controllers/discoveryController.js';

const router = express.Router();
router.get('/openid-configuration', discoveryMetadata);
export default router;
