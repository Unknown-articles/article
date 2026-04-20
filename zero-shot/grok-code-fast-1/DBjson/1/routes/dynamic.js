const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../utils/fileOps');
const { applyFilters, applySorting, applyPagination } = require('../utils/query');

const router = express.Router();

// GET /:resource - List all items with optional filtering, sorting, pagination
router.get('/:resource', async (req, res) => {
  const { resource } = req.params;
  const db = await readDB();
  let items = db[resource] || [];
  items = applyFilters(items, req.query);
  items = applySorting(items, req.query.sort);
  items = applyPagination(items, req.query.limit, req.query.offset);
  res.json(items);
});

// GET /:resource/:id - Get single item
router.get('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const db = await readDB();
  const collection = db[resource] || [];
  const item = collection.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// POST /:resource - Create new item
router.post('/:resource', async (req, res) => {
  const { resource } = req.params;
  const data = req.body;
  const db = await readDB();
  if (!db[resource]) db[resource] = [];
  const newItem = { ...data, id: uuidv4(), ownerId: req.user.id, createdAt: new Date().toISOString() };
  db[resource].push(newItem);
  await writeDB(db);
  res.status(201).json(newItem);
});

// PUT /:resource/:id - Replace item
router.put('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const data = req.body;
  const db = await readDB();
  const collection = db[resource] || [];
  const index = collection.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  const updatedItem = { ...data, id, ownerId: collection[index].ownerId, updatedAt: new Date().toISOString() };
  collection[index] = updatedItem;
  await writeDB(db);
  res.json(updatedItem);
});

// PATCH /:resource/:id - Update item
router.patch('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const data = req.body;
  const db = await readDB();
  const collection = db[resource] || [];
  const index = collection.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  const updatedItem = { ...collection[index], ...data, updatedAt: new Date().toISOString() };
  collection[index] = updatedItem;
  await writeDB(db);
  res.json(updatedItem);
});

// DELETE /:resource/:id - Delete item
router.delete('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const db = await readDB();
  const collection = db[resource] || [];
  const index = collection.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  collection.splice(index, 1);
  await writeDB(db);
  res.json({ message: 'Item deleted' });
});

module.exports = router;