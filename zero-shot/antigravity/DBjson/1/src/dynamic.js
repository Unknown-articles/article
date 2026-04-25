const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { modifyDB, readDB } = require('./db');
const { verifyToken } = require('./auth');

const router = express.Router();

router.use(verifyToken);

router.param('resource', (req, res, next, resource) => {
  if (resource === '_users' || resource === '_teams') {
    return res.status(403).json({ error: 'Reserved collection' });
  }
  next();
});

function hasAccess(item, user, requiredAccess, data) {
  if (user.role === 'admin') return true;
  if (item.ownerId === user.id) return true;
  if (requiredAccess === 'delete') return false;

  if (item.sharedWith && Array.isArray(item.sharedWith)) {
    const share = item.sharedWith.find(s => s.userId === user.id);
    if (share && (requiredAccess === 'read' || share.access === 'write')) {
      return true;
    }
  }

  if (item.sharedWithTeams && Array.isArray(item.sharedWithTeams)) {
    for (const share of item.sharedWithTeams) {
      if (requiredAccess === 'read' || share.access === 'write') {
        const team = data._teams.find(t => t.id === share.teamId);
        if (team && team.members.includes(user.id)) return true;
      }
    }
  }

  return false;
}

function applyFilters(items, conditions, isOr) {
  if (conditions.length === 0) return items;

  return items.filter(item => {
    let matches = conditions.map(cond => {
      const { field, op, value } = cond;
      let itemVal = item[field];

      if (value === 'true' || value === 'false') {
        const boolVal = value === 'true';
        if (op === 'eq') return itemVal === boolVal;
        if (op === 'ne') return itemVal !== boolVal;
      }

      if (op === 'eq') return itemVal == value;
      if (op === 'ne') return itemVal != value;
      if (op === 'gt') return Number(itemVal) > Number(value);
      if (op === 'gte') return Number(itemVal) >= Number(value);
      if (op === 'lt') return Number(itemVal) < Number(value);
      if (op === 'lte') return Number(itemVal) <= Number(value);
      if (op === 'between') {
        const [lo, hi] = value.split(',');
        const num = Number(itemVal);
        return num >= Number(lo) && num <= Number(hi);
      }
      if (op === 'contains' && typeof itemVal === 'string') return itemVal.toLowerCase().includes(String(value).toLowerCase());
      if (op === 'startswith' && typeof itemVal === 'string') return itemVal.toLowerCase().startsWith(String(value).toLowerCase());
      if (op === 'endswith' && typeof itemVal === 'string') return itemVal.toLowerCase().endsWith(String(value).toLowerCase());
      if (op === 'in') {
        const list = value.split(',');
        return list.includes(String(itemVal));
      }
      return false;
    });

    if (isOr) {
      return matches.some(m => m);
    } else {
      return matches.every(m => m);
    }
  });
}

function parseQuery(query) {
  const metaFields = ['_sort', '_order', '_limit', '_offset', '_or'];
  const conditions = [];

  for (const key in query) {
    if (metaFields.includes(key)) continue;

    const value = query[key];
    if (key.includes('__')) {
      const parts = key.split('__');
      const op = parts.pop();
      const field = parts.join('__');
      conditions.push({ field, op, value });
    } else {
      conditions.push({ field: key, op: 'eq', value });
    }
  }

  return conditions;
}

router.post('/:resource', async (req, res) => {
  const { resource } = req.params;
  const body = req.body || {};

  delete body.id;
  delete body.ownerId;
  delete body.createdAt;
  delete body.updatedAt;

  const newItem = {
    ...body,
    id: uuidv4(),
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await modifyDB(async (data) => {
      if (!data[resource]) data[resource] = [];
      data[resource].push(newItem);
      return data;
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:resource', async (req, res) => {
  const { resource } = req.params;

  try {
    const data = await readDB();
    let items = data[resource] || [];

    // 1. Accessibility filter
    if (req.user.role !== 'admin') {
      items = items.filter(item => hasAccess(item, req.user, 'read', data));
    }

    // 2. Query filter
    const conditions = parseQuery(req.query);
    items = applyFilters(items, conditions, req.query._or === 'true');

    // 3. Sorting
    if (req.query._sort) {
      const sortField = req.query._sort;
      const order = req.query._order === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * order;
        if (a[sortField] > b[sortField]) return 1 * order;
        return 0;
      });
    }

    // 4. Pagination
    const total = items.length;
    let limit = req.query._limit ? parseInt(req.query._limit) : undefined;
    let offset = req.query._offset ? parseInt(req.query._offset) : undefined;

    if (limit !== undefined || offset !== undefined) {
      const start = offset || 0;
      const end = limit !== undefined ? start + limit : undefined;
      items = items.slice(start, end);
      return res.status(200).json({ data: items, total, limit, offset });
    }

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;

  try {
    const data = await readDB();
    const items = data[resource] || [];
    const item = items.find(i => i.id === id);

    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!hasAccess(item, req.user, 'read', data)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const body = req.body || {};

  let updatedItem;
  try {
    await modifyDB(async (data) => {
      if (!data[resource]) data[resource] = [];
      const items = data[resource];
      const index = items.findIndex(i => i.id === id);

      if (index === -1) {
        const err = new Error('Not found'); err.status = 404; throw err;
      }
      const existing = items[index];
      if (!hasAccess(existing, req.user, 'write', data)) {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }

      delete body.id;
      delete body.ownerId;
      delete body.createdAt;
      delete body.updatedAt;

      updatedItem = {
        ...body,
        id: existing.id,
        ownerId: existing.ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      items[index] = updatedItem;
      return data;
    });
    res.status(200).json(updatedItem);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;
  const body = req.body || {};

  let updatedItem;
  try {
    await modifyDB(async (data) => {
      if (!data[resource]) data[resource] = [];
      const items = data[resource];
      const index = items.findIndex(i => i.id === id);

      if (index === -1) {
        const err = new Error('Not found'); err.status = 404; throw err;
      }
      const existing = items[index];
      if (!hasAccess(existing, req.user, 'write', data)) {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }

      delete body.id;
      delete body.ownerId;
      delete body.createdAt;
      delete body.updatedAt;

      updatedItem = {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString()
      };

      items[index] = updatedItem;
      return data;
    });
    res.status(200).json(updatedItem);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:resource/:id', async (req, res) => {
  const { resource, id } = req.params;

  try {
    await modifyDB(async (data) => {
      if (!data[resource]) data[resource] = [];
      const items = data[resource];
      const index = items.findIndex(i => i.id === id);

      if (index === -1) {
        const err = new Error('Not found'); err.status = 404; throw err;
      }
      const existing = items[index];
      if (!hasAccess(existing, req.user, 'delete', data)) {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }

      items.splice(index, 1);
      return data;
    });
    res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = {
  dynamicRouter: router
};
