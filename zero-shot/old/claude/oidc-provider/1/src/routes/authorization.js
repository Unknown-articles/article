import { Router } from 'express';
import express from 'express';
import { showAuthorizationForm, handleAuthorization } from '../controllers/authorizationController.js';

const router = Router();

router.get( '/authorize', showAuthorizationForm);
router.post('/authorize', express.urlencoded({ extended: false }), handleAuthorization);

export default router;
