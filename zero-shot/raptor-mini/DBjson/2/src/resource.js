const express = require('express');
const { v4: uuidv4 } = require('uuid');
const makeAuthMiddleware = require('./middleware');
const { filterItems, applySorting, applyPagination, getUserTeamIds } = require('./utils');

const reservedResources = new Set(['_users', '_teams']);

function getSharedAccess(item, userId, userTeamIds) {
  const sharedWith = Array.isArray(item.sharedWith) ? item.sharedWith : [];
  const sharedWithTeams = Array.isArray(item.sharedWithTeams) ? item.sharedWithTeams : [];

  const userEntry = sharedWith.find((entry) => entry && entry.userId === userId);
  if (userEntry) {
    return userEntry.access;
  }

  const teamEntry = sharedWithTeams.find(
    (entry) => entry && userTeamIds.includes(entry.teamId)
  );
  return teamEntry ? teamEntry.access : null;
}

function canReadItem(item, user, userTeamIds) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  const access = getSharedAccess(item, user.id, userTeamIds);
  return access === 'read' || access === 'write';
}

function canWriteItem(item, user, userTeamIds) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  const access = getSharedAccess(item, user.id, userTeamIds);
  return access === 'write';
}

function canDeleteItem(item, user) {
  if (user.role === 'admin') return true;
  return item.ownerId === user.id;
}

function sanitizeResourceBody(body) {
  if (!body || typeof body !== 'object') return {};
  const copy = { ...body };
  delete copy.id;
  delete copy.ownerId;
  delete copy.createdAt;
  return copy;
}

function parseQuery(query) {
  const items = filterItems(query.items || [], query);
  const sorted = applySorting(items, query._sort, query._order);
  const { results, limit, offset } = applyPagination(sorted, query._limit, query._offset);
  return { results, total: sorted.length, limit, offset };
}

module.exports = function createResourceRouter(db) {
  const router = express.Router();
  const { authenticate } = makeAuthMiddleware(db);

  async function loadCollection(resource) {
    const data = await db.getData();
    return Array.isArray(data[resource]) ? data[resource] : [];
  }

  router.post('/:resource', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    const now = new Date().toISOString();
    const newItem = {
      id: uuidv4(),
      ownerId: req.user.id,
      createdAt: now,
      updatedAt: now,
      ...sanitizeResourceBody(body),
    };

    const savedItem = await db.withData(async (data) => {
      if (!Array.isArray(data[resource])) {
        data[resource] = [];
      }
      data[resource].push(newItem);
      return newItem;
    });

    return res.status(201).json(savedItem);
  });

  router.get('/:resource', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const data = await db.getData();
    const items = Array.isArray(data[resource]) ? data[resource] : [];
    const teamIds = getUserTeamIds(req.user.id, data._teams || []);
    const visible = items.filter((item) => canReadItem(item, req.user, teamIds));

    const queryInput = {
      items: visible,
      _sort: req.query._sort,
      _order: req.query._order,
      _limit: req.query._limit,
      _offset: req.query._offset,
      _or: req.query._or,
      ...req.query,
    };

    const { results, total } = parseQuery(queryInput);
    const hasPagination = Object.prototype.hasOwnProperty.call(req.query, '_limit') || Object.prototype.hasOwnProperty.call(req.query, '_offset');
    if (hasPagination) {
      const normalizedLimit = req.query._limit !== undefined ? Number(req.query._limit) : results.length;
      const normalizedOffset = req.query._offset !== undefined ? Number(req.query._offset) : 0;
      return res.json({ data: results, total, limit: normalizedLimit, offset: normalizedOffset });
    }

    return res.json(results);
  });

  router.get('/:resource/:id', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const items = await loadCollection(resource);
    const item = items.find((entry) => entry.id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const teamIds = getUserTeamIds(req.user.id, (await db.getData())._teams || []);
    if (!canReadItem(item, req.user, teamIds)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(item);
  });

  router.put('/:resource/:id', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    const updated = await db.withData(async (data) => {
      const collection = Array.isArray(data[resource]) ? data[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) return null;
      const current = collection[index];
      const teamIds = getUserTeamIds(req.user.id, data._teams || []);
      if (!canWriteItem(current, req.user, teamIds)) {
        return { error: 'forbidden' };
      }
      const now = new Date().toISOString();
      const replacement = {
        ...sanitizeResourceBody(body),
        id: current.id,
        ownerId: current.ownerId,
        createdAt: current.createdAt,
        updatedAt: now,
      };
      collection[index] = replacement;
      data[resource] = collection;
      return replacement;
    });

    if (!updated) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (updated.error === 'forbidden') {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(updated);
  });

  router.patch('/:resource/:id', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    const updated = await db.withData(async (data) => {
      const collection = Array.isArray(data[resource]) ? data[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) return null;
      const current = collection[index];
      const teamIds = getUserTeamIds(req.user.id, data._teams || []);
      if (!canWriteItem(current, req.user, teamIds)) {
        return { error: 'forbidden' };
      }
      const now = new Date().toISOString();
      const patch = sanitizeResourceBody(body);
      const merged = {
        ...current,
        ...patch,
        id: current.id,
        ownerId: current.ownerId,
        createdAt: current.createdAt,
        updatedAt: now,
      };
      collection[index] = merged;
      data[resource] = collection;
      return merged;
    });

    if (!updated) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (updated.error === 'forbidden') {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(updated);
  });

  router.delete('/:resource/:id', authenticate, async (req, res) => {
    const resource = req.params.resource;
    if (reservedResources.has(resource)) {
      return res.status(403).json({ error: 'Reserved resource name' });
    }

    const deleted = await db.withData(async (data) => {
      const collection = Array.isArray(data[resource]) ? data[resource] : [];
      const index = collection.findIndex((entry) => entry.id === req.params.id);
      if (index === -1) return null;
      const item = collection[index];
      if (!canDeleteItem(item, req.user)) {
        return { error: 'forbidden' };
      }
      collection.splice(index, 1);
      data[resource] = collection;
      return item;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (deleted.error === 'forbidden') {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.status(204).send();
  });

  return router;
};
