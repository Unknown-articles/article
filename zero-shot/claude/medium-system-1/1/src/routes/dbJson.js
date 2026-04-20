import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as jsonDb from '../services/jsonDb.js';

const router = Router();

// All /api routes require a valid OIDC access token
router.use(requireAuth);

// GET /:collection
router.get('/:collection', async (req, res, next) => {
  try {
    const result = await jsonDb.getAll(req.params.collection, req.query, req.user.id, req.user.role);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:collection/:id
router.get('/:collection/:id', async (req, res, next) => {
  try {
    const item = await jsonDb.getById(req.params.collection, req.params.id, req.user.id, req.user.role);
    if (!item) return res.status(404).json({ error: 'not_found', message: 'Resource not found' });
    if (item.forbidden) return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    res.json(item);
  } catch (err) { next(err); }
});

// POST /:collection
router.post('/:collection', async (req, res, next) => {
  try {
    const item = await jsonDb.create(req.params.collection, req.body, req.user.id);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PUT /:collection/:id
router.put('/:collection/:id', async (req, res, next) => {
  try {
    const result = await jsonDb.update(req.params.collection, req.params.id, req.body, req.user.id, req.user.role, false);
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Resource not found' });
    if (result.forbidden) return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /:collection/:id
router.patch('/:collection/:id', async (req, res, next) => {
  try {
    const result = await jsonDb.update(req.params.collection, req.params.id, req.body, req.user.id, req.user.role, true);
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Resource not found' });
    if (result.forbidden) return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /:collection/:id
router.delete('/:collection/:id', async (req, res, next) => {
  try {
    const result = await jsonDb.remove(req.params.collection, req.params.id, req.user.id, req.user.role);
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Resource not found' });
    if (result.forbidden) return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
