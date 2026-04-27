const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { parseQueryOptions, applyQueryFilters, sortItems, paginateItems } = require('../utils/query');

const router = express.Router();

function isReserved(resource) {
  return config.reservedCollections.includes(resource);
}

function normalizeSharedEntries(entries, idField) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      [idField]: String(entry[idField] || ''),
      access: entry.access === 'write' ? 'write' : 'read'
    }))
    .filter((entry) => entry[idField]);
}

function removeSystemFields(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const { id, ownerId, createdAt, updatedAt, ...rest } = payload;
  return rest;
}

function getUserTeamIds(teams, userId) {
  return teams.filter((team) => Array.isArray(team.members) && team.members.includes(userId)).map((team) => team.id);
}

function getSharedAccess(item, userId, teamIds) {
  let access = null;

  if (Array.isArray(item.sharedWith)) {
    item.sharedWith.forEach((entry) => {
      if (entry && entry.userId === userId) {
        if (entry.access === 'write') access = 'write';
        if (access !== 'write' && entry.access === 'read') access = 'read';
      }
    });
  }

  if (Array.isArray(item.sharedWithTeams)) {
    item.sharedWithTeams.forEach((entry) => {
      if (entry && teamIds.includes(entry.teamId)) {
        if (entry.access === 'write') access = 'write';
        if (access !== 'write' && entry.access === 'read') access = 'read';
      }
    });
  }

  return access;
}

function canViewItem(item, user, teamIds) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  return Boolean(getSharedAccess(item, user.id, teamIds));
}

function canEditItem(item, user, teamIds) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  return getSharedAccess(item, user.id, teamIds) === 'write';
}

function canDeleteItem(item, user) {
  if (user.role === 'admin') return true;
  return item.ownerId === user.id;
}

router.use('/:resource', authenticateToken, async (req, res, next) => {
  if (isReserved(req.params.resource)) {
    return res.status(403).json({ error: 'Reserved resource name' });
  }
  next();
});

router.post('/:resource', async (req, res) => {
  const resource = req.params.resource;
  const payload = req.body;
  const values = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : { value: payload };
  const now = new Date().toISOString();
  const item = {
    ...removeSystemFields(values),
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    createdAt: now,
    updatedAt: now
  };

  if (Array.isArray(values.sharedWith)) {
    item.sharedWith = normalizeSharedEntries(values.sharedWith, 'userId');
  }
  if (Array.isArray(values.sharedWithTeams)) {
    item.sharedWithTeams = normalizeSharedEntries(values.sharedWithTeams, 'teamId');
  }

  await db.ensureCollection(resource);
  const created = await db.createItem(resource, item);
  return res.status(201).json(created);
});

router.get('/:resource', async (req, res) => {
  const resource = req.params.resource;
  const collection = await db.getCollection(resource);
  const teams = await db.getCollection('_teams');
  const userTeamIds = getUserTeamIds(teams, req.user.id);

  const visibleItems = collection.filter((item) => canViewItem(item, req.user, userTeamIds));
  const { filters, options } = parseQueryOptions(req.query);
  let results = applyQueryFilters(visibleItems, filters, options.or);
  results = sortItems(results, options.sort, options.order);

  const shouldEnvelope = options.limit != null || options.offset > 0;
  if (shouldEnvelope) {
    const page = paginateItems(results, options.limit, options.offset);
    return res.json(page);
  }

  return res.json(results);
});

router.get('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  const item = (await db.getCollection(resource)).find((record) => record.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }

  const teams = await db.getCollection('_teams');
  const userTeamIds = getUserTeamIds(teams, req.user.id);
  if (!canViewItem(item, req.user, userTeamIds)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  return res.json(item);
});

router.put('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  const collection = await db.getCollection(resource);
  const item = collection.find((record) => record.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }

  const teams = await db.getCollection('_teams');
  const userTeamIds = getUserTeamIds(teams, req.user.id);
  if (!canEditItem(item, req.user, userTeamIds)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const payload = req.body;
  const cleaned = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : { value: payload };
  const now = new Date().toISOString();
  const replacement = {
    ...removeSystemFields(cleaned),
    id: item.id,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
    updatedAt: now
  };

  if (Array.isArray(cleaned.sharedWith)) {
    replacement.sharedWith = normalizeSharedEntries(cleaned.sharedWith, 'userId');
  }
  if (Array.isArray(cleaned.sharedWithTeams)) {
    replacement.sharedWithTeams = normalizeSharedEntries(cleaned.sharedWithTeams, 'teamId');
  }

  const updated = await db.updateCollectionItem(resource, item.id, () => replacement);
  return res.json(updated);
});

router.patch('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  const collection = await db.getCollection(resource);
  const item = collection.find((record) => record.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }

  const teams = await db.getCollection('_teams');
  const userTeamIds = getUserTeamIds(teams, req.user.id);
  if (!canEditItem(item, req.user, userTeamIds)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const payload = req.body;
  const updates = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : { value: payload };
  const sanitized = removeSystemFields(updates);

  if (Array.isArray(updates.sharedWith)) {
    sanitized.sharedWith = normalizeSharedEntries(updates.sharedWith, 'userId');
  }
  if (Array.isArray(updates.sharedWithTeams)) {
    sanitized.sharedWithTeams = normalizeSharedEntries(updates.sharedWithTeams, 'teamId');
  }

  const now = new Date().toISOString();

  const updated = await db.updateCollectionItem(resource, item.id, (current) => {
    if (!current) return null;
    return {
      ...current,
      ...sanitized,
      id: current.id,
      ownerId: current.ownerId,
      createdAt: current.createdAt,
      updatedAt: now
    };
  });

  return res.json(updated);
});

router.delete('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  const collection = await db.getCollection(resource);
  const item = collection.find((record) => record.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }

  if (!canDeleteItem(item, req.user)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const deleted = await db.deleteCollectionItem(resource, item.id);
  if (!deleted) {
    return res.status(404).json({ error: 'item not found' });
  }

  return res.status(200).json({ success: true });
});

module.exports = router;
