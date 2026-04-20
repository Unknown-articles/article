import { Router } from 'express';
import { createItem, getItems, getItem, updateItem, deleteItem } from '../db/jsonDb.js';

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

// Partial update
router.patch('/:collection/:id', async (req, res) => {
  try {
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

// Batch update multiple items in a collection
router.patch('/:collection/batch', async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected an array of items' });

    const updatedItems = [];
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.id) continue;
      const updated = await updateItem(req.params.collection, item.id, item, true);
      if (updated) updatedItems.push(updated);
    }

    res.json(updatedItems);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
