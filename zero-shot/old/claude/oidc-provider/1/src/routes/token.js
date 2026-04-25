import { Router } from 'express';
import express from 'express';
import { issueToken } from '../controllers/tokenController.js';

const router = Router();

// OAuth 2.0 spec: token endpoint MUST accept application/x-www-form-urlencoded
router.post('/token', express.urlencoded({ extended: false }), issueToken);

export default router;
