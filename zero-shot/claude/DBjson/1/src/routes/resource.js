'use strict';
const express = require('express');
const crypto = require('crypto');
const { transaction, readOnly } = require('../db');
const { authenticate } = require('../middleware/auth');
const { applyQuery } = require('../utils/query');

const router = express.Router();

const RESERVED = new Set(['_users', '_teams']);

function isReserved(name) {
  return RESERVED.has(name);
}

// Returns 'owner' | 'write' | 'read' | null
function getUserAccess(item, userId, userTeamIds) {
  if (item.ownerId === userId) return 'owner';

  if (Array.isArray(item.sharedWith)) {
    const share = item.sharedWith.find(s => s.userId === userId);
    if (share) return share.access; // 'read' | 'write'
  }

  if (Array.isArray(item.sharedWithTeams) && userTeamIds.length > 0) {
    let best = null;
    for (const ts of item.sharedWithTeams) {
      if (userTeamIds.includes(ts.teamId)) {
        if (ts.access === 'write') return 'write';
        best = 'read';
      }
    }
    if (best) return best;
  }

  return null;
}

const canRead   = a => a === 'owner' || a === 'read'  || a === 'write';
const canWrite  = a => a === 'owner' || a === 'write';
const canDelete = a => a === 'owner';

// ── POST /:resource ───────────────────────────────────────────────────────────

router.post('/:resource', authenticate, async (req, res, next) => {
  try {
    const { resource } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    const body = req.body || {};
    // Strip client-supplied system fields
    const { id: _i, ownerId: _o, createdAt: _c, ...rest } = body;
    const now = new Date().toISOString();

    const item = await transaction(db => {
      if (!Array.isArray(db[resource])) db[resource] = [];
      const newItem = { ...rest, id: crypto.randomUUID(), ownerId: req.user.id, createdAt: now };
      db[resource].push(newItem);
      return newItem;
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// ── GET /:resource ────────────────────────────────────────────────────────────

router.get('/:resource', authenticate, async (req, res, next) => {
  try {
    const { resource } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    const result = await readOnly(db => {
      const collection = db[resource] || [];

      let items;
      if (req.user.role === 'admin') {
        items = collection;
      } else {
        const userTeamIds = db._teams
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
        items = collection.filter(item => canRead(getUserAccess(item, req.user.id, userTeamIds)));
      }

      return applyQuery(items, req.query);
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /:resource/:id ────────────────────────────────────────────────────────

router.get('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    let item, userTeamIds = [];
    await readOnly(db => {
      item = (db[resource] || []).find(i => i.id === id);
      if (req.user.role !== 'admin') {
        userTeamIds = db._teams
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
      }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (req.user.role !== 'admin') {
      if (!canRead(getUserAccess(item, req.user.id, userTeamIds))) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// ── PUT /:resource/:id ────────────────────────────────────────────────────────

router.put('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    const body = req.body || {};
    const { id: _i, ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = body;

    const updated = await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) {
        const err = new Error('Item not found'); err.status = 404; throw err;
      }
      const existing = collection[idx];

      if (req.user.role !== 'admin') {
        const userTeamIds = db._teams
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
        if (!canWrite(getUserAccess(existing, req.user.id, userTeamIds))) {
          const err = new Error('Access denied'); err.status = 403; throw err;
        }
      }

      const newItem = {
        ...rest,
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      collection[idx] = newItem;
      return newItem;
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── PATCH /:resource/:id ──────────────────────────────────────────────────────

router.patch('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    const body = req.body || {};
    // Discard any attempt to overwrite system fields
    const { id: _i, ownerId: _o, createdAt: _c, ...rest } = body;

    const updated = await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) {
        const err = new Error('Item not found'); err.status = 404; throw err;
      }
      const existing = collection[idx];

      if (req.user.role !== 'admin') {
        const userTeamIds = db._teams
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
        if (!canWrite(getUserAccess(existing, req.user.id, userTeamIds))) {
          const err = new Error('Access denied'); err.status = 403; throw err;
        }
      }

      const newItem = {
        ...existing,
        ...rest,
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      collection[idx] = newItem;
      return newItem;
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── DELETE /:resource/:id ─────────────────────────────────────────────────────

router.delete('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    if (isReserved(resource)) {
      return res.status(403).json({ error: `Collection '${resource}' is reserved` });
    }

    await transaction(db => {
      const collection = db[resource] || [];
      const idx = collection.findIndex(i => i.id === id);
      if (idx === -1) {
        const err = new Error('Item not found'); err.status = 404; throw err;
      }
      const existing = collection[idx];

      // Only owner or admin can delete; write-shared users cannot
      if (req.user.role !== 'admin' && !canDelete(getUserAccess(existing, req.user.id, []))) {
        const err = new Error('Access denied'); err.status = 403; throw err;
      }

      collection.splice(idx, 1);
    });

    res.status(204).send();
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
