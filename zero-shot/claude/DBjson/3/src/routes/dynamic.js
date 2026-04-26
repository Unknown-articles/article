const express = require('express');
const { transaction, readDb } = require('../db/fileDb');
const { authenticate } = require('../middleware/auth');
const { canRead, canWrite, canDelete } = require('../utils/sharing');
const { applyQuery } = require('../utils/query');
const ApiError = require('../errors/ApiError');

const router = express.Router();

const RESERVED_COLLECTIONS = new Set(['_users', '_teams']);

function newId() {
  return crypto.randomUUID();
}

function guardCollection(name) {
  if (RESERVED_COLLECTIONS.has(name)) {
    throw new ApiError(403, `Collection "${name}" is reserved`);
  }
}

/** Collect team IDs the caller belongs to. */
function getUserTeamIds(db, userId) {
  return db._teams
    .filter(t => t.members.includes(userId))
    .map(t => t.id);
}

// ─── POST /:resource ─────────────────────────────────────────────────────────
router.post('/:resource', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource } = req.params;

    const item = await transaction(db => {
      if (!db[resource]) db[resource] = [];

      // Strip client-supplied system fields
      const { id: _id, ownerId: _ow, createdAt: _ca, ...body } = req.body || {};

      const newItem = {
        ...body,
        id: newId(),
        ownerId: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db[resource].push(newItem);
      return newItem;
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// ─── GET /:resource ───────────────────────────────────────────────────────────
router.get('/:resource', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource } = req.params;

    const result = await readDb(db => {
      const collection = db[resource] || [];
      const teamIds = getUserTeamIds(db, req.user.id);

      let visible;
      if (req.user.role === 'admin') {
        visible = collection;
      } else {
        visible = collection.filter(item =>
          canRead(item, req.user.id, teamIds)
        );
      }

      return applyQuery(visible, req.query);
    });

    const { items, total, limit, offset, paginated } = result;

    if (paginated) {
      res.json({ data: items, total, limit, offset });
    } else {
      res.json(items);
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /:resource/:id ───────────────────────────────────────────────────────
router.get('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource, id } = req.params;

    const { item, teamIds } = await readDb(db => ({
      item: (db[resource] || []).find(i => i.id === id) || null,
      teamIds: getUserTeamIds(db, req.user.id),
    }));

    if (!item) throw new ApiError(404, 'Item not found');

    if (req.user.role !== 'admin' && !canRead(item, req.user.id, teamIds)) {
      throw new ApiError(403, 'Access denied');
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:resource/:id ───────────────────────────────────────────────────────
router.put('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource, id } = req.params;

    const updated = await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, 'Item not found');

      const existing = collection[idx];
      const teamIds = getUserTeamIds(db, req.user.id);

      if (req.user.role !== 'admin' && !canWrite(existing, req.user.id, teamIds)) {
        throw new ApiError(403, 'Access denied');
      }

      // Strip client-supplied immutable fields
      const { id: _id, ownerId: _ow, createdAt: _ca, updatedAt: _ua, ...body } = req.body || {};

      collection[idx] = {
        ...body,
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return collection[idx];
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:resource/:id ─────────────────────────────────────────────────────
router.patch('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource, id } = req.params;

    const updated = await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, 'Item not found');

      const existing = collection[idx];
      const teamIds = getUserTeamIds(db, req.user.id);

      if (req.user.role !== 'admin' && !canWrite(existing, req.user.id, teamIds)) {
        throw new ApiError(403, 'Access denied');
      }

      // Strip immutable fields from patch body
      const { id: _id, ownerId: _ow, createdAt: _ca, ...patch } = req.body || {};

      collection[idx] = {
        ...existing,
        ...patch,
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return collection[idx];
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:resource/:id ────────────────────────────────────────────────────
router.delete('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    guardCollection(req.params.resource);
    const { resource, id } = req.params;

    await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, 'Item not found');

      const existing = collection[idx];

      if (req.user.role !== 'admin' && !canDelete(existing, req.user.id)) {
        throw new ApiError(403, 'Only the owner or admin can delete this resource');
      }

      collection.splice(idx, 1);
    });

    res.status(200).json({ message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
