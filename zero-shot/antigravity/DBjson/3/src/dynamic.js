const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { authenticate } = require('./middleware');
const { evaluateFilters, applySortAndPagination } = require('./query');

const router = express.Router();

router.use(authenticate);

function getUserTeams(db, userId) {
  return (db._teams || []).filter(t => t.members.includes(userId)).map(t => t.id);
}

function hasAccess(item, user, userTeams, requiredAccess = 'read') {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;

  if (item.sharedWith && Array.isArray(item.sharedWith)) {
    const share = item.sharedWith.find(s => s.userId === user.id);
    if (share) {
      if (requiredAccess === 'read') return true;
      if (requiredAccess === 'write' && share.access === 'write') return true;
    }
  }

  if (item.sharedWithTeams && Array.isArray(item.sharedWithTeams)) {
    const share = item.sharedWithTeams.find(s => userTeams.includes(s.teamId));
    if (share) {
      if (requiredAccess === 'read') return true;
      if (requiredAccess === 'write' && share.access === 'write') return true;
    }
  }

  return false;
}

router.param('resource', (req, res, next, resource) => {
  if (resource === '_users' || resource === '_teams') {
    return res.status(403).json({ error: 'Reserved collection' });
  }
  next();
});

router.post('/:resource', async (req, res) => {
  const { resource } = req.params;
  const data = req.body || {};

  try {
    const db = await readDb();
    if (!db[resource]) db[resource] = [];

    const now = new Date().toISOString();
    const newItem = {
      ...data,
      id: uuidv4(),
      ownerId: req.user.id,
      createdAt: now,
      updatedAt: now
    };

    db[resource].push(newItem);
    await writeDb(db);

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:resource', async (req, res) => {
  const { resource } = req.params;

  try {
    const db = await readDb();
    let items = db[resource] || [];
    const userTeams = getUserTeams(db, req.user.id);

    // Apply ownership/sharing first
    items = items.filter(item => hasAccess(item, req.user, userTeams, 'read'));

    // Apply filters
    items = evaluateFilters(items, req.query);

    // Apply sort and pagination
    const result = applySortAndPagination(items, req.query);

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;

  try {
    const db = await readDb();
    const items = db[resource] || [];
    const item = items.find(i => i.id === id);

    if (!item) return res.status(404).json({ error: 'Not found' });

    const userTeams = getUserTeams(db, req.user.id);
    if (!hasAccess(item, req.user, userTeams, 'read')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const data = req.body || {};

  try {
    const db = await readDb();
    const items = db[resource] || [];
    const itemIndex = items.findIndex(i => i.id === id);

    if (itemIndex === -1) return res.status(404).json({ error: 'Not found' });

    const item = items[itemIndex];
    const userTeams = getUserTeams(db, req.user.id);

    if (!hasAccess(item, req.user, userTeams, 'write')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedItem = {
      ...data,
      id: item.id,
      ownerId: item.ownerId,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString()
    };

    db[resource][itemIndex] = updatedItem;
    await writeDb(db);

    res.status(200).json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const data = req.body || {};

  try {
    const db = await readDb();
    const items = db[resource] || [];
    const itemIndex = items.findIndex(i => i.id === id);

    if (itemIndex === -1) return res.status(404).json({ error: 'Not found' });

    const item = items[itemIndex];
    const userTeams = getUserTeams(db, req.user.id);

    if (!hasAccess(item, req.user, userTeams, 'write')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedItem = {
      ...item,
      ...data,
      id: item.id,
      ownerId: item.ownerId,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString()
    };

    db[resource][itemIndex] = updatedItem;
    await writeDb(db);

    res.status(200).json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;

  try {
    const db = await readDb();
    const items = db[resource] || [];
    const itemIndex = items.findIndex(i => i.id === id);

    if (itemIndex === -1) return res.status(404).json({ error: 'Not found' });

    const item = items[itemIndex];

    if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db[resource].splice(itemIndex, 1);
    await writeDb(db);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
