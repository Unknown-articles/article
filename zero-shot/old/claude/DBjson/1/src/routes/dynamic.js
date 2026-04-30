'use strict';

/**
 * Dynamic resource router.
 *
 * Mounted at  /:resource  in index.js (with mergeParams: true).
 * Handles any collection name not reserved by the system.
 *
 * RBAC / Ownership rules
 * ──────────────────────
 * admin:  unrestricted access to every collection and item.
 *
 * user:   GET (list / single)  – own items + items shared with them (directly or via team)
 *         POST                 – create items in any collection (ownerId = caller)
 *         PUT / PATCH          – own items OR items shared with write access
 *         DELETE               – own items only (not shared-write)
 *
 * Shared-access payload fields on each resource item:
 *   sharedWith      [ { userId, access: "read"|"write" } ]
 *   sharedWithTeams [ { teamId, access: "read"|"write" } ]
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db       = require('../db/fileDb');
const ApiError = require('../errors/ApiError');
const { applyQuery } = require('../utils/query');

const router = express.Router({ mergeParams: true });

// Collections the dynamic router must never touch
const RESERVED = new Set(['_users', '_teams', 'auth', 'health']);

// ---------------------------------------------------------------------------
// Access helpers (synchronous – receive live data object)
// ---------------------------------------------------------------------------

function canRead(user, item, data) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  if (item.sharedWith?.some(s => s.userId === user.id)) return true;
  if (item.sharedWithTeams?.length) {
    const teams = data._teams || [];
    return item.sharedWithTeams.some(st => {
      const team = teams.find(t => t.id === st.teamId);
      return team?.members.includes(user.id);
    });
  }
  return false;
}

function canWrite(user, item, data) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  if (item.sharedWith?.some(s => s.userId === user.id && s.access === 'write')) return true;
  if (item.sharedWithTeams?.length) {
    const teams = data._teams || [];
    return item.sharedWithTeams.some(st => {
      if (st.access !== 'write') return false;
      const team = teams.find(t => t.id === st.teamId);
      return team?.members.includes(user.id);
    });
  }
  return false;
}

function guardReserved(resource) {
  if (RESERVED.has(resource)) {
    throw new ApiError(403, `Collection "${resource}" is reserved`);
  }
}

// ---------------------------------------------------------------------------
// GET /:resource  – list (with filtering, sorting, pagination)
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { resource } = req.params;
    guardReserved(resource);

    const data  = await db.read();
    const items = (data[resource] || []).filter(item => canRead(req.user, item, data));

    res.json(applyQuery(items, req.query));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /:resource/:id  – single item
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    guardReserved(resource);

    const data = await db.read();
    const item = (data[resource] || []).find(i => i.id === id);

    if (!item) throw new ApiError(404, `${resource}/${id} not found`);
    if (!canRead(req.user, item, data)) throw new ApiError(403, 'Forbidden');

    res.json(item);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /:resource  – create
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { resource } = req.params;
    guardReserved(resource);

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const created = await db.transaction(data => {
      if (!data[resource]) data[resource] = [];

      // Protect immutable system fields supplied by the client
      const { id: _id, ownerId: _ow, createdAt: _ca, updatedAt: _ua, ...rest } = body;

      const item = {
        ...rest,
        id:             uuidv4(),
        ownerId:        req.user.id,
        sharedWith:     Array.isArray(body.sharedWith)      ? body.sharedWith      : [],
        sharedWithTeams:Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : [],
        createdAt:      new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
      };
      data[resource].push(item);
      return item;
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /:resource/:id  – full replace (preserves system fields)
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    guardReserved(resource);

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const updated = await db.transaction(data => {
      const col = data[resource] || [];
      const idx = col.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, `${resource}/${id} not found`);

      const existing = col[idx];
      if (!canWrite(req.user, existing, data)) throw new ApiError(403, 'Forbidden');

      const { id: _id, ownerId: _ow, createdAt: _ca, updatedAt: _ua, ...rest } = body;

      const item = {
        ...rest,
        id:             existing.id,
        ownerId:        existing.ownerId,
        sharedWith:     Array.isArray(body.sharedWith)      ? body.sharedWith      : existing.sharedWith,
        sharedWithTeams:Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : existing.sharedWithTeams,
        createdAt:      existing.createdAt,
        updatedAt:      new Date().toISOString(),
      };
      data[resource][idx] = item;
      return item;
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PATCH /:resource/:id  – partial update
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    guardReserved(resource);

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const updated = await db.transaction(data => {
      const col = data[resource] || [];
      const idx = col.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, `${resource}/${id} not found`);

      const existing = col[idx];
      if (!canWrite(req.user, existing, data)) throw new ApiError(403, 'Forbidden');

      const { id: _id, ownerId: _ow, createdAt: _ca, updatedAt: _ua, ...patch } = body;

      const item = {
        ...existing,
        ...patch,
        // Always protect system fields
        id:        existing.id,
        ownerId:   existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        // Allow updating sharing config via patch
        sharedWith:      Array.isArray(body.sharedWith)      ? body.sharedWith      : existing.sharedWith,
        sharedWithTeams: Array.isArray(body.sharedWithTeams) ? body.sharedWithTeams : existing.sharedWithTeams,
      };
      data[resource][idx] = item;
      return item;
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// DELETE /:resource/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    guardReserved(resource);

    await db.transaction(data => {
      const col = data[resource] || [];
      const idx = col.findIndex(i => i.id === id);
      if (idx === -1) throw new ApiError(404, `${resource}/${id} not found`);

      const item = col[idx];
      // DELETE is restricted to owner or admin (shared-write is NOT enough)
      if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
        throw new ApiError(403, 'Only the owner or an admin can delete this resource');
      }
      col.splice(idx, 1);
    });

    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;

// RBAC note: canRead / canWrite enforce role-based access.
// admin role bypasses all ownership checks (see top of file).
