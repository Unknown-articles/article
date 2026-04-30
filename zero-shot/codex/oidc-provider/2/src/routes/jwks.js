import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { getPublicJwks, rotateSigningKey } from '../services/keys.js';

export const jwksRouter = Router();

jwksRouter.get('/.well-known/jwks.json', asyncHandler(async (req, res) => {
  res.json(await getPublicJwks());
}));

jwksRouter.post('/admin/keys/rotate', asyncHandler(async (req, res) => {
  const key = await rotateSigningKey();
  res.status(201).json({ kid: key.kid, active: true });
}));
