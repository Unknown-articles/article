import { Router } from 'express';
import {
  createItem,
  getItems,
  getItem,
  updateItem,
  deleteItem,
  replaceCollection,
} from '../db/jsonDb.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const ALLOWED_COLLECTIONS = new Set(['tasks', 'messages']);

router.use('/:collection', requireAuth, (req, res, next) => {
  if (!ALLOWED_COLLECTIONS.has(req.params.collection)) {
    return res.status(404).json({ error: 'Unknown collection' });
  }
  next();
});

router.get('/:collection', async (req, res) => {
  try {
    const items = await getItems(req.params.collection, req.query);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:collection', async (req, res) => {
  try {
    const item = await createItem(req.params.collection, req.body);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:collection', async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Collection payload must be an array' });
    }
    await replaceCollection(req.params.collection, req.body);
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:collection/:id', async (req, res) => {
  try {
    const item = await getItem(req.params.collection, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:collection/:id', async (req, res) => {
  try {
    const item = await updateItem(req.params.collection, req.params.id, req.body, false);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:collection/:id', async (req, res) => {
  try {
    const item = await updateItem(req.params.collection, req.params.id, req.body, true);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:collection/:id', async (req, res) => {
  try {
    const deleted = await deleteItem(req.params.collection, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
