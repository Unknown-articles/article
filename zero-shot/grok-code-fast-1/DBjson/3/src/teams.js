const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

module.exports = (db, authenticate, requireAdmin) => {
  router.post('/', authenticate, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const data = await db.read();
    const teams = data._teams;
    const team = { id: uuidv4(), name, ownerId: req.user.id, members: [req.user.id] };
    teams.push(team);
    await db.enqueueWrite(async () => {
      await db.write({ ...data, _teams: teams });
    });
    res.status(201).json(team);
  });

  router.get('/', authenticate, async (req, res) => {
    const data = await db.read();
    const teams = data._teams.filter(t => t.members.includes(req.user.id));
    res.json(teams);
  });

  router.get('/:id', authenticate, async (req, res) => {
    const data = await db.read();
    const team = data._teams.find(t => t.id === req.params.id && t.members.includes(req.user.id));
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  });

  router.patch('/:id', authenticate, async (req, res) => {
    const data = await db.read();
    const team = data._teams.find(t => t.id === req.params.id);
    if (!team || team.ownerId !== req.user.id) return res.status(403).json({ error: 'Not owner' });
    const { name } = req.body;
    if (name) team.name = name;
    await db.enqueueWrite(async () => {
      await db.write(data);
    });
    res.json(team);
  });

  router.delete('/:id', authenticate, async (req, res) => {
    const data = await db.read();
    const index = data._teams.findIndex(t => t.id === req.params.id && t.ownerId === req.user.id);
    if (index === -1) return res.status(403).json({ error: 'Not owner or not found' });
    data._teams.splice(index, 1);
    await db.enqueueWrite(async () => {
      await db.write(data);
    });
    res.status(204).send();
  });

  router.post('/:id/members', authenticate, async (req, res) => {
    const { userId } = req.body;
    const data = await db.read();
    const team = data._teams.find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (!data._users.find(u => u.id === userId)) return res.status(400).json({ error: 'User not found' });
    if (team.members.includes(userId)) return res.status(400).json({ error: 'Already member' });
    team.members.push(userId);
    await db.enqueueWrite(async () => {
      await db.write(data);
    });
    res.json(team);
  });

  router.delete('/:id/members/:userId', authenticate, async (req, res) => {
    const data = await db.read();
    const team = data._teams.find(t => t.id === req.params.id);
    if (!team || team.ownerId !== req.user.id) return res.status(403).json({ error: 'Not owner' });
    const index = team.members.indexOf(req.params.userId);
    if (index === -1) return res.status(400).json({ error: 'Not member' });
    team.members.splice(index, 1);
    await db.enqueueWrite(async () => {
      await db.write(data);
    });
    res.json(team);
  });

  return router;
};