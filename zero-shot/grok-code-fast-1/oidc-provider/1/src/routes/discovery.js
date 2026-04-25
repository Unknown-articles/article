import express from 'express';
import { getDiscovery } from '../controllers/discovery.js';

const router = express.Router();

router.get('/.well-known/openid-configuration', getDiscovery);

export default router;