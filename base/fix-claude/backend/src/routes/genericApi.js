import { Router } from 'express';
import { createItem, getItems, getItem, updateItem, deleteItem } from '../db/jsonDb.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Only alphanumeric collection names to prevent path traversal
const VALID_COLLECTION = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

function validateCollection(req, res, next) {
  if (!VALID_COLLECTION.test(req.params.collection)) {
    return res.status(400).json({ error: 'invalid_collection' });
  }
  next();
}

// All routes require authentication
router.use(requireAuth);

// List / query
router.get('/:collection', validateCollection, async (req, res) => {
  try {
    const items = await getItems(req.params.collection, req.query);
    res.json(items);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Get by id
router.get('/:collection/:id', validateCollection, async (req, res) => {
  try {
    const item = await getItem(req.params.collection, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Create
router.post('/:collection', validateCollection, async (req, res) => {
  try {
    const item = await createItem(req.params.collection, req.body);
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Full replace
router.put('/:collection/:id', validateCollection, async (req, res) => {
  try {
    const item = await updateItem(req.params.collection, req.params.id, req.body, false);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Partial update
router.patch('/:collection/:id', validateCollection, async (req, res) => {
  try {
    const item = await updateItem(req.params.collection, req.params.id, req.body, true);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Delete
router.delete('/:collection/:id', validateCollection, async (req, res) => {
  try {
    const deleted = await deleteItem(req.params.collection, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
