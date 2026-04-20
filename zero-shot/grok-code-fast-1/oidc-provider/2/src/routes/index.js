import express from 'express';
import discoveryRoutes from './discovery.js';
import jwksRoutes from './jwks.js';
import authorizeRoutes from './authorize.js';
import tokenRoutes from './token.js';
import userinfoRoutes from './userinfo.js';

const router = express.Router();

router.use('/', discoveryRoutes);
router.use('/', jwksRoutes);
router.use('/', authorizeRoutes);
router.use('/', tokenRoutes);
router.use('/', userinfoRoutes);

export default router;