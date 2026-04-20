const express = require('express');
const {v4: uuidv4} = require('uuid');
const {authenticate} = require('../middleware/authMiddleware');
const {isAdmin, isOwner, normalizeSharedWith, canRead, canWrite, canDelete, sanitizeResourcePayload} = require('../utils/access');
const {queryCollection} = require('../utils/query');
const DataStore = require('../dataStore');

const router = express.Router();
router.use(authenticate);

function isReservedResource(resource) {
  return DataStore.isReservedCollection(resource);
}

async function loadTeams(dataStore) {
  return dataStore.getCollection('_teams');
}

async function ensureResourceCollection(dataStore, resource) {
  if (isReservedResource(resource)) {
    return null;
  }
  await dataStore.ensureCollection(resource);
  return resource;
}

function getShareAccess(user, item, teams) {
  if (isAdmin(user) || isOwner(user, item)) return 'write';
  const entries = Array.isArray(item.sharedWith) ? item.sharedWith : [];
  const direct = entries.find((entry) => entry.type === 'user' && entry.id === user.id);
  if (direct) return direct.access;
  const teamIds = (teams || []).filter((team) => Array.isArray(team.members) && team.members.includes(user.id)).map((team) => team.id);
  const teamShare = entries.find((entry) => entry.type === 'team' && teamIds.includes(entry.id));
  return teamShare ? teamShare.access : null;
}

function canAccessRead(user, item, teams) {
  return Boolean(getShareAccess(user, item, teams));
}

function canAccessWrite(user, item, teams) {
  return getShareAccess(user, item, teams) === 'write';
}

router.post('/:resource', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }

  await ensureResourceCollection(res.locals.dataStore || req.app.locals.dataStore || req.dataStore, resource);
  const body = req.body || {};
  const resourceItem = {
    id: uuidv4(),
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
    ...sanitizeResourcePayload(body, true)
  };
  if (body.sharedWith) {
    resourceItem.sharedWith = normalizeSharedWith(body.sharedWith);
  }
  const created = await req.app.locals.dataStore.addItem(resource, resourceItem);
  res.status(201).json(created);
});

router.get('/:resource', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }
  const items = await req.app.locals.dataStore.getCollection(resource);
  const teams = await loadTeams(req.app.locals.dataStore);
  const filtered = items.filter((item) => canAccessRead(req.user, item, teams));
  const result = queryCollection(filtered, req.query);
  res.json(result);
});

router.get('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }
  const item = await req.app.locals.dataStore.getItem(resource, req.params.id);
  if (!item) {
    return res.status(404).json({error: 'Resource not found'});
  }
  const teams = await loadTeams(req.app.locals.dataStore);
  if (!canAccessRead(req.user, item, teams)) {
    return res.status(403).json({error: 'Forbidden'});
  }
  res.json(item);
});

router.put('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }
  const existing = await req.app.locals.dataStore.getItem(resource, req.params.id);
  if (!existing) {
    return res.status(404).json({error: 'Resource not found'});
  }
  const teams = await loadTeams(req.app.locals.dataStore);
  if (!canAccessWrite(req.user, existing, teams)) {
    return res.status(403).json({error: 'Forbidden'});
  }
  const body = req.body || {};
  const sharedWith = Array.isArray(body.sharedWith) && isOwner(req.user, existing) ? normalizeSharedWith(body.sharedWith) : existing.sharedWith;
  const payload = sanitizeResourcePayload(body, false);
  const updated = {
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    ...payload,
    sharedWith
  };
  const saved = await req.app.locals.dataStore.updateItem(resource, existing.id, updated);
  res.json(saved);
});

router.patch('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }
  const existing = await req.app.locals.dataStore.getItem(resource, req.params.id);
  if (!existing) {
    return res.status(404).json({error: 'Resource not found'});
  }
  const teams = await loadTeams(req.app.locals.dataStore);
  if (!canAccessWrite(req.user, existing, teams)) {
    return res.status(403).json({error: 'Forbidden'});
  }
  const body = req.body || {};
  let sharedWith = existing.sharedWith;
  if (body.sharedWith && isOwner(req.user, existing)) {
    sharedWith = normalizeSharedWith(body.sharedWith);
  }
  const payload = sanitizeResourcePayload(body, false);
  const updated = {
    ...existing,
    ...payload,
    sharedWith
  };
  const saved = await req.app.locals.dataStore.updateItem(resource, existing.id, updated);
  res.json(saved);
});

router.delete('/:resource/:id', async (req, res) => {
  const resource = req.params.resource;
  if (isReservedResource(resource)) {
    return res.status(404).json({error: 'Reserved collection'});
  }
  const existing = await req.app.locals.dataStore.getItem(resource, req.params.id);
  if (!existing) {
    return res.status(404).json({error: 'Resource not found'});
  }
  if (!canDelete(req.user, existing)) {
    return res.status(403).json({error: 'Forbidden'});
  }
  await req.app.locals.dataStore.removeItem(resource, existing.id);
  res.status(204).send();
});

module.exports = (dataStore) => {
  const mounted = express.Router();
  mounted.use((req, res, next) => {
    req.app.locals.dataStore = dataStore;
    next();
  });
  mounted.use('/', router);
  return mounted;
};
