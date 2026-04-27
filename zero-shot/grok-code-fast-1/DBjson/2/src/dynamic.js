const { updateDB, readDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

function parseQuery(req) {
  const query = req.query;
  const filters = [];
  const sort = query._sort;
  const order = query._order || 'asc';
  const limit = query._limit ? parseInt(query._limit) : null;
  const offset = query._offset ? parseInt(query._offset) : 0;
  const or = query._or === 'true';
  for (const key in query) {
    if (key.startsWith('_')) continue;
    const parts = key.split('__');
    const field = parts[0];
    const op = parts[1] || 'eq';
    const value = query[key];
    filters.push({ field, op, value });
  }
  return { filters, sort, order, limit, offset, or };
}

function applyFilter(item, filter) {
  const { field, op, value } = filter;
  const itemValue = item[field];
  if (itemValue == null) return false;
  switch (op) {
    case 'eq':
      return itemValue == value;
    case 'ne':
      return itemValue != value;
    case 'gt':
      return parseFloat(itemValue) > parseFloat(value);
    case 'gte':
      return parseFloat(itemValue) >= parseFloat(value);
    case 'lt':
      return parseFloat(itemValue) < parseFloat(value);
    case 'lte':
      return parseFloat(itemValue) <= parseFloat(value);
    case 'between':
      const [lo, hi] = value.split(',').map(parseFloat);
      return parseFloat(itemValue) >= lo && parseFloat(itemValue) <= hi;
    case 'contains':
      return String(itemValue).toLowerCase().includes(value.toLowerCase());
    case 'startswith':
      return String(itemValue).toLowerCase().startsWith(value.toLowerCase());
    case 'endswith':
      return String(itemValue).toLowerCase().endsWith(value.toLowerCase());
    case 'in':
      return value.split(',').includes(String(itemValue));
    default:
      return true;
  }
}

function hasAccess(item, userId, role, teams) {
  if (role === 'admin') return true;
  if (item.ownerId === userId) return true;
  if (item.sharedWith && item.sharedWith.some(s => s.userId === userId && (s.access === 'read' || s.access === 'write'))) return true;
  if (item.sharedWithTeams && item.sharedWithTeams.some(s => {
    const team = teams.find(t => t.id === s.teamId);
    return team && team.members.includes(userId) && (s.access === 'read' || s.access === 'write');
  })) return true;
  return false;
}

function hasWriteAccess(item, userId, role, teams) {
  if (role === 'admin') return true;
  if (item.ownerId === userId) return true;
  if (item.sharedWith && item.sharedWith.some(s => s.userId === userId && s.access === 'write')) return true;
  if (item.sharedWithTeams && item.sharedWithTeams.some(s => {
    const team = teams.find(t => t.id === s.teamId);
    return team && team.members.includes(userId) && s.access === 'write';
  })) return true;
  return false;
}

async function handleGet(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const { filters, sort, order, limit, offset, or } = parseQuery(req);
  const data = await readDB();
  let items = data[resource] || [];
  const teams = data._teams;
  items = items.filter(item => hasAccess(item, req.user.id, req.user.role, teams));
  if (filters.length > 0) {
    items = items.filter(item => {
      const results = filters.map(f => applyFilter(item, f));
      return or ? results.some(r => r) : results.every(r => r);
    });
  }
  if (sort) {
    items.sort((a, b) => {
      const aVal = a[sort];
      const bVal = b[sort];
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
  const total = items.length;
  if (offset) items = items.slice(offset);
  if (limit) items = items.slice(0, limit);
  if (limit || offset) {
    res.json({ data: items, total, limit, offset });
  } else {
    res.json(items);
  }
}

async function handleGetOne(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const id = req.params.id;
  const data = await readDB();
  const items = data[resource] || [];
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const teams = data._teams;
  if (!hasAccess(item, req.user.id, req.user.role, teams)) return res.status(403).json({ error: 'Forbidden' });
  res.json(item);
}

async function handlePost(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const item = {
    id: uuidv4(),
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
    ...req.body
  };
  delete item.id;
  delete item.ownerId;
  delete item.createdAt;
  await updateDB(data => {
    if (!data[resource]) data[resource] = [];
    data[resource].push(item);
  });
  res.status(201).json(item);
}

async function handlePut(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const id = req.params.id;
  const update = req.body;
  const data = await readDB();
  const items = data[resource] || [];
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const item = items[index];
  const teams = data._teams;
  if (!hasWriteAccess(item, req.user.id, req.user.role, teams)) return res.status(403).json({ error: 'Forbidden' });
  const updatedItem = {
    ...item,
    ...update,
    id: item.id,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
    updatedAt: new Date().toISOString()
  };
  await updateDB(data => {
    data[resource][index] = updatedItem;
  });
  res.json(updatedItem);
}

async function handlePatch(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const id = req.params.id;
  const update = req.body;
  const data = await readDB();
  const items = data[resource] || [];
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const item = items[index];
  const teams = data._teams;
  if (!hasWriteAccess(item, req.user.id, req.user.role, teams)) return res.status(403).json({ error: 'Forbidden' });
  const updatedItem = {
    ...item,
    ...update,
    updatedAt: new Date().toISOString()
  };
  await updateDB(data => {
    data[resource][index] = updatedItem;
  });
  res.json(updatedItem);
}

async function handleDelete(req, res) {
  const resource = req.params.resource;
  if (resource.startsWith('_') || resource === 'auth') return res.status(403).json({ error: 'Reserved' });
  const id = req.params.id;
  const data = await readDB();
  const items = data[resource] || [];
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const item = items[index];
  const teams = data._teams;
  if (req.user.role !== 'admin' && item.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  await updateDB(data => {
    data[resource].splice(index, 1);
  });
  res.status(204).send();
}

module.exports = { handleGet, handleGetOne, handlePost, handlePut, handlePatch, handleDelete };