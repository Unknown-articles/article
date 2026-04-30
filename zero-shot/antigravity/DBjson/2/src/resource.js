const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, updateDB } = require('./db');
const { authenticate } = require('./auth');

const router = express.Router();

const reserved = ['_users', '_teams'];

router.use('/:resource', authenticate, (req, res, next) => {
  const resource = req.params.resource;
  if (reserved.includes(resource) || resource === 'auth') {
    return res.status(403).json({ error: 'Reserved collection' });
  }
  next();
});

const hasAccess = (item, userId, userTeams, requiredAccess = 'read') => {
  if (item.ownerId === userId) return true;
  
  if (item.sharedWith && Array.isArray(item.sharedWith)) {
    const share = item.sharedWith.find(s => s.userId === userId);
    if (share && (share.access === 'write' || requiredAccess === 'read')) {
      return true;
    }
  }

  if (item.sharedWithTeams && Array.isArray(item.sharedWithTeams)) {
    const share = item.sharedWithTeams.find(s => userTeams.includes(s.teamId));
    if (share && (share.access === 'write' || requiredAccess === 'read')) {
      return true;
    }
  }

  return false;
};

const applyFilters = (collection, query) => {
  const filters = [];
  let isOr = false;
  let sortField = null;
  let sortOrder = 'asc';
  let limit = null;
  let offset = null;

  for (const [key, value] of Object.entries(query)) {
    if (key === '_or') {
      isOr = value === 'true';
      continue;
    }
    if (key === '_sort') { sortField = value; continue; }
    if (key === '_order') { sortOrder = value; continue; }
    if (key === '_limit') { limit = parseInt(value, 10); continue; }
    if (key === '_offset') { offset = parseInt(value, 10); continue; }

    let field = key;
    let operator = 'eq';
    if (key.includes('__')) {
      const parts = key.split('__');
      field = parts[0];
      operator = parts[1];
    }
    filters.push({ field, operator, value });
  }

  let filtered = collection;
  if (filters.length > 0) {
    filtered = collection.filter(item => {
      const results = filters.map(({ field, operator, value }) => {
        const itemVal = item[field];
        if (itemVal === undefined) return false;
        
        let target = value;
        if (target === 'true') target = true;
        if (target === 'false') target = false;
        
        const isNumeric = !isNaN(Number(target)) && typeof target !== 'boolean';
        const numTarget = isNumeric ? Number(target) : target;
        const numItemVal = !isNaN(Number(itemVal)) ? Number(itemVal) : itemVal;

        switch (operator) {
          case 'eq': return itemVal == target;
          case 'ne': return itemVal != target;
          case 'gt': return numItemVal > numTarget;
          case 'gte': return numItemVal >= numTarget;
          case 'lt': return numItemVal < numTarget;
          case 'lte': return numItemVal <= numTarget;
          case 'between': {
            const [lo, hi] = String(value).split(',').map(Number);
            return numItemVal >= lo && numItemVal <= hi;
          }
          case 'contains': return String(itemVal).toLowerCase().includes(String(target).toLowerCase());
          case 'startswith': return String(itemVal).toLowerCase().startsWith(String(target).toLowerCase());
          case 'endswith': return String(itemVal).toLowerCase().endsWith(String(target).toLowerCase());
          case 'in': return String(value).split(',').includes(String(itemVal));
          default: return false;
        }
      });
      return isOr ? results.some(r => r) : results.every(r => r);
    });
  }

  if (sortField) {
    filtered = filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      const cmp = valA > valB ? 1 : -1;
      return sortOrder === 'desc' ? -cmp : cmp;
    });
  }

  const total = filtered.length;

  if (limit !== null || offset !== null) {
    const start = offset || 0;
    const end = limit !== null ? start + limit : undefined;
    const paginatedData = filtered.slice(start, end);
    return {
      data: paginatedData,
      total,
      limit,
      offset: start
    };
  }

  return filtered;
};

router.post('/:resource', authenticate, async (req, res) => {
  const resource = req.params.resource;
  try {
    let newItem;
    await updateDB(data => {
      if (!data[resource]) {
        data[resource] = [];
      }
      const now = new Date().toISOString();
      const { id, ownerId, createdAt, updatedAt, ...rest } = req.body;
      newItem = {
        ...rest,
        id: uuidv4(),
        ownerId: req.user.id,
        createdAt: now,
        updatedAt: now
      };
      data[resource].push(newItem);
      return data;
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:resource', authenticate, async (req, res) => {
  const resource = req.params.resource;
  const db = await getDB();
  let collection = db[resource] || [];

  if (req.user.role !== 'admin') {
    const userTeams = (db._teams || [])
      .filter(t => t.members.includes(req.user.id))
      .map(t => t.id);

    collection = collection.filter(item => hasAccess(item, req.user.id, userTeams, 'read'));
  }

  const result = applyFilters(collection, req.query);
  res.json(result);
});

router.get('/:resource/:id', authenticate, async (req, res) => {
  const { resource, id } = req.params;
  const db = await getDB();
  const collection = db[resource] || [];
  const item = collection.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  if (req.user.role !== 'admin') {
    const userTeams = (db._teams || [])
      .filter(t => t.members.includes(req.user.id))
      .map(t => t.id);
      
    if (!hasAccess(item, req.user.id, userTeams, 'read')) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json(item);
});

router.put('/:resource/:id', authenticate, async (req, res) => {
  const { resource, id } = req.params;
  try {
    let updatedItem;
    await updateDB(data => {
      const collection = data[resource] || [];
      const index = collection.findIndex(i => i.id === id);
      if (index === -1) {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
      const item = collection[index];
      
      if (req.user.role !== 'admin') {
        const userTeams = (data._teams || [])
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
        
        if (!hasAccess(item, req.user.id, userTeams, 'write')) {
          const error = new Error('Access denied');
          error.status = 403;
          throw error;
        }
      }
      
      const now = new Date().toISOString();
      const { id: reqId, ownerId, createdAt, updatedAt, ...rest } = req.body;
      
      updatedItem = {
        ...rest,
        id: item.id,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        updatedAt: now
      };
      collection[index] = updatedItem;
      return data;
    });
    res.json(updatedItem);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:resource/:id', authenticate, async (req, res) => {
  const { resource, id } = req.params;
  try {
    let updatedItem;
    await updateDB(data => {
      const collection = data[resource] || [];
      const index = collection.findIndex(i => i.id === id);
      if (index === -1) {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
      const item = collection[index];
      
      if (req.user.role !== 'admin') {
        const userTeams = (data._teams || [])
          .filter(t => t.members.includes(req.user.id))
          .map(t => t.id);
        
        if (!hasAccess(item, req.user.id, userTeams, 'write')) {
          const error = new Error('Access denied');
          error.status = 403;
          throw error;
        }
      }
      
      const now = new Date().toISOString();
      const { id: reqId, ownerId, createdAt, updatedAt, ...rest } = req.body;
      
      updatedItem = {
        ...item,
        ...rest,
        id: item.id,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        updatedAt: now
      };
      collection[index] = updatedItem;
      return data;
    });
    res.json(updatedItem);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:resource/:id', authenticate, async (req, res) => {
  const { resource, id } = req.params;
  try {
    await updateDB(data => {
      const collection = data[resource] || [];
      const index = collection.findIndex(i => i.id === id);
      if (index === -1) {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
      const item = collection[index];
      
      if (req.user.role !== 'admin' && item.ownerId !== req.user.id) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }
      
      collection.splice(index, 1);
      return data;
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
