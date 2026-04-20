import { Router } from 'express';
import { createItem, getItems, getItem, updateItem, deleteItem, bulkPatchItems } from '../db/jsonDb.js';

const router = Router();

// List / query
router.get('/:collection', async (req, res) => {
  try {
    const items = await getItems(req.params.collection, req.query);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get by id
router.get('/:collection/:id', async (req, res) => {
  try {
    const item = await getItem(req.params.collection, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create
router.post('/:collection', async (req, res) => {
  try {
    const item = await createItem(req.params.collection, req.body);
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Full replace
router.put('/:collection/:id', async (req, res) => {
  try {
    const item = await updateItem(req.params.collection, req.params.id, req.body, false);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk partial update
router.patch('/:collection/bulk', async (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array' });
    const items = await bulkPatchItems(req.params.collection, req.body);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Partial update
router.patch('/:collection/:id', async (req, res, next) => {
  try {
    if (req.params.id === 'bulk') return next(); // Fallback safety
    const item = await updateItem(req.params.collection, req.params.id, req.body, true);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete
router.delete('/:collection/:id', async (req, res) => {
  try {
    const deleted = await deleteItem(req.params.collection, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
