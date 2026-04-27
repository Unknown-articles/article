const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('./auth');
const {
  isReservedResource,
  applyQuery,
  removeSystemFields,
  validateShareEntries,
} = require('./utils');

const router = express.Router();
router.use(requireAuth);

function createId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function getUserTeamIds(user, database) {
  return database._teams
    .filter((team) => Array.isArray(team.members) && team.members.includes(user.id))
    .map((team) => team.id);
}

function getShareAccess(item, user, database) {
  if (!item || !user) {
    return { read: false, write: false, delete: false };
  }

  if (user.role === 'admin') {
    return { read: true, write: true, delete: true };
  }

  if (item.ownerId === user.id) {
    return { read: true, write: true, delete: true };
  }

  const userShare = Array.isArray(item.sharedWith)
    ? item.sharedWith.find((entry) => entry.userId === user.id)
    : null;
  if (userShare) {
    return {
      read: true,
      write: userShare.access === 'write',
      delete: false,
    };
  }

  const teamIds = getUserTeamIds(user, database);
  const teamShare = Array.isArray(item.sharedWithTeams)
    ? item.sharedWithTeams.find((entry) => teamIds.includes(entry.teamId))
    : null;

  if (teamShare) {
    return {
      read: true,
      write: teamShare.access === 'write',
      delete: false,
    };
  }

  return { read: false, write: false, delete: false };
}

function canReadItem(item, user, database) {
  if (!item) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (item.ownerId === user.id) {
    return true;
  }

  const access = getShareAccess(item, user, database);
  return access.read;
}

function canWriteItem(item, user, database) {
  if (!item) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (item.ownerId === user.id) {
    return true;
  }

  const access = getShareAccess(item, user, database);
  return access.write;
}

function canDeleteItem(item, user, database) {
  if (!item) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  return item.ownerId === user.id;
}

function getVisibleItems(user, items, database) {
  if (user.role === 'admin') {
    return items;
  }

  return items.filter((item) => canReadItem(item, user, database));
}

function buildItem(payload, ownerId) {
  const now = new Date().toISOString();
  const item = {
    id: createId(),
    ownerId,
    createdAt: now,
    updatedAt: now,
    ...removeSystemFields(payload),
  };

  const sharedWith = validateShareEntries(payload.sharedWith, 'user');
  const sharedWithTeams = validateShareEntries(payload.sharedWithTeams, 'team');

  if (Array.isArray(sharedWith)) {
    item.sharedWith = sharedWith;
  }

  if (Array.isArray(sharedWithTeams)) {
    item.sharedWithTeams = sharedWithTeams;
  }

  return item;
}

function updateItem(existing, payload) {
  const updated = {
    ...existing,
    ...removeSystemFields(payload),
    updatedAt: new Date().toISOString(),
  };

  if (Array.isArray(payload.sharedWith)) {
    updated.sharedWith = validateShareEntries(payload.sharedWith, 'user');
  }

  if (Array.isArray(payload.sharedWithTeams)) {
    updated.sharedWithTeams = validateShareEntries(payload.sharedWithTeams, 'team');
  }

  updated.id = existing.id;
  updated.ownerId = existing.ownerId;
  updated.createdAt = existing.createdAt;
  return updated;
}

router.post('/:resource', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  try {
    const item = await db.modifyDatabase(async (database) => {
      if (!Array.isArray(database[resource])) {
        database[resource] = [];
      }

      const newItem = buildItem(req.body, req.user.id);
      database[resource].push(newItem);
      return newItem;
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.get('/:resource', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  try {
    const database = await db.readDatabase();
    const collection = Array.isArray(database[resource]) ? database[resource] : [];
    const visible = getVisibleItems(req.user, collection, database);
    const queryResult = applyQuery(visible, req.query);

    if (queryResult.envelope) {
      return res.json({
        data: queryResult.data,
        total: queryResult.total,
        limit: queryResult.limit,
        offset: queryResult.offset,
      });
    }

    res.json(queryResult.data);
  } catch (error) {
    next(error);
  }
});

router.get('/:resource/:id', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  try {
    const database = await db.readDatabase();
    const collection = Array.isArray(database[resource]) ? database[resource] : [];
    const item = collection.find((entry) => entry.id === req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (!canReadItem(item, req.user, database)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.put('/:resource/:id', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  try {
    const updated = await db.modifyDatabase(async (database) => {
      const collection = Array.isArray(database[resource]) ? database[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) {
        const error = new Error('Resource not found');
        error.status = 404;
        throw error;
      }

      const existing = collection[index];
      if (!canWriteItem(existing, req.user, database)) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }

      const nextItem = updateItem(existing, req.body);
      collection[index] = nextItem;
      return nextItem;
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.patch('/:resource/:id', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  try {
    const updated = await db.modifyDatabase(async (database) => {
      const collection = Array.isArray(database[resource]) ? database[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) {
        const error = new Error('Resource not found');
        error.status = 404;
        throw error;
      }

      const existing = collection[index];
      if (!canWriteItem(existing, req.user, database)) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }

      const nextItem = updateItem(existing, req.body);
      collection[index] = nextItem;
      return nextItem;
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:resource/:id', async (req, res, next) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(403).json({ error: 'Reserved collection name' });
  }

  try {
    await db.modifyDatabase(async (database) => {
      const collection = Array.isArray(database[resource]) ? database[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) {
        const error = new Error('Resource not found');
        error.status = 404;
        throw error;
      }

      const item = collection[index];
      if (!canDeleteItem(item, req.user, database)) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }

      collection.splice(index, 1);
      return null;
    });

    res.status(204).end();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
