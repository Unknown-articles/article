const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

module.exports = (db, authenticate) => {
  const canAccess = (user, item, action, data) => {
    if (user.role === 'admin') return true;
    if (item.ownerId === user.id) return true;
    // Check sharedWith
    const shared = item.sharedWith?.find(s => s.userId === user.id);
    if (shared) {
      if (action === 'read' && ['read', 'write'].includes(shared.access)) return true;
      if (action === 'write' && shared.access === 'write') return true;
    }
    // Check sharedWithTeams
    const teamShared = item.sharedWithTeams?.find(s => {
      const team = data._teams.find(t => t.id === s.teamId && t.members.includes(user.id));
      return team && (action === 'read' ? ['read', 'write'].includes(s.access) : s.access === 'write');
    });
    if (teamShared) return true;
    return false;
  };

  router.all('/:resource', async (req, res) => {
    const resource = req.params.resource;
    if (resource.startsWith('_')) return res.status(403).json({ error: 'Reserved' });
    authenticate(req, res, async () => {
      const data = await db.read();
      if (!data[resource]) data[resource] = [];
      const collection = data[resource];
      if (req.method === 'GET') {
        let items = collection.filter(item => canAccess(req.user, item, 'read', data));
        // Querying
        const query = req.query;
        const filters = {};
        for (const key in query) {
          if (key.startsWith('_')) continue;
          const value = query[key];
          if (key.includes('__')) {
            const [field, op] = key.split('__');
            filters[field] = { op, value };
          } else {
            filters[key] = { op: 'eq', value };
          }
        }
        const orMode = query._or === 'true';
        items = items.filter(item => {
          let match = orMode ? false : true;
          for (const field in filters) {
            const { op, value } = filters[field];
            const itemValue = item[field];
            let fieldMatch = false;
            switch (op) {
              case 'eq':
                fieldMatch = itemValue == value;
                break;
              case 'ne':
                fieldMatch = itemValue != value;
                break;
              case 'gt':
                fieldMatch = Number(itemValue) > Number(value);
                break;
              case 'gte':
                fieldMatch = Number(itemValue) >= Number(value);
                break;
              case 'lt':
                fieldMatch = Number(itemValue) < Number(value);
                break;
              case 'lte':
                fieldMatch = Number(itemValue) <= Number(value);
                break;
              case 'between':
                const [lo, hi] = value.split(',');
                fieldMatch = Number(itemValue) >= Number(lo) && Number(itemValue) <= Number(hi);
                break;
              case 'contains':
                fieldMatch = String(itemValue).toLowerCase().includes(value.toLowerCase());
                break;
              case 'startswith':
                fieldMatch = String(itemValue).toLowerCase().startsWith(value.toLowerCase());
                break;
              case 'endswith':
                fieldMatch = String(itemValue).toLowerCase().endsWith(value.toLowerCase());
                break;
              case 'in':
                fieldMatch = value.split(',').includes(String(itemValue));
                break;
            }
            if (orMode) {
              match = match || fieldMatch;
            } else {
              match = match && fieldMatch;
            }
          }
          return match;
        });
        // Sort
        const sortField = query._sort;
        if (sortField) {
          const order = query._order === 'desc' ? -1 : 1;
          items.sort((a, b) => {
            if (a[sortField] < b[sortField]) return -order;
            if (a[sortField] > b[sortField]) return order;
            return 0;
          });
        }
        // Pagination
        const limit = parseInt(query._limit);
        const offset = parseInt(query._offset) || 0;
        const total = items.length;
        if (limit) {
          items = items.slice(offset, offset + limit);
        }
        if (limit || offset) {
          res.json({ data: items, total, limit, offset });
        } else {
          res.json(items);
        }
      } else if (req.method === 'POST') {
        const item = { ...req.body, id: uuidv4(), ownerId: req.user.id, createdAt: new Date().toISOString() };
        collection.push(item);
        await db.enqueueWrite(async () => {
          await db.write(data);
        });
        res.status(201).json(item);
      }
    });
  });

  router.all('/:resource/:id', async (req, res) => {
    const resource = req.params.resource;
    if (resource.startsWith('_')) return res.status(403).json({ error: 'Reserved' });
    authenticate(req, res, async () => {
      const data = await db.read();
      if (!data[resource]) return res.status(404).json({ error: 'Resource not found' });
      const collection = data[resource];
      const item = collection.find(i => i.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      if (req.method === 'GET') {
        if (!canAccess(req.user, item, 'read', data)) return res.status(403).json({ error: 'Access denied' });
        res.json(item);
      } else if (req.method === 'PUT') {
        if (!canAccess(req.user, item, 'write', data)) return res.status(403).json({ error: 'Access denied' });
        const updated = { ...req.body, id: item.id, ownerId: item.ownerId, createdAt: item.createdAt, updatedAt: new Date().toISOString() };
        Object.assign(item, updated);
        await db.enqueueWrite(async () => {
          await db.write(data);
        });
        res.json(item);
      } else if (req.method === 'PATCH') {
        if (!canAccess(req.user, item, 'write', data)) return res.status(403).json({ error: 'Access denied' });
        const updatedFields = { ...req.body };
        delete updatedFields.id;
        delete updatedFields.ownerId;
        delete updatedFields.createdAt;
        Object.assign(item, updatedFields, { updatedAt: new Date().toISOString() });
        await db.enqueueWrite(async () => {
          await db.write(data);
        });
        res.json(item);
      } else if (req.method === 'DELETE') {
        if (item.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
        const index = collection.indexOf(item);
        collection.splice(index, 1);
        await db.enqueueWrite(async () => {
          await db.write(data);
        });
        res.status(204).send();
      }
    });
  });

  return router;
};