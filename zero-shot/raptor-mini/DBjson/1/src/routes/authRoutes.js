const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {v4: uuidv4} = require('uuid');
const {authenticate, authorizeRole, jwtSecret} = require('../middleware/authMiddleware');

module.exports = (dataStore) => {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const {username, password} = req.body || {};
    if (!username || !password) {
      return res.status(400).json({error: 'username and password are required'});
    }

    const users = await dataStore.getCollection('_users');
    if (users.some((user) => user.username === username)) {
      return res.status(400).json({error: 'username already exists'});
    }

    const role = users.length === 0 ? 'admin' : 'user';
    const user = {
      id: uuidv4(),
      username,
      password: await bcrypt.hash(password, 10),
      role,
      createdAt: new Date().toISOString()
    };
    await dataStore.addItem('_users', user);
    const token = jwt.sign({id: user.id, username: user.username, role: user.role}, jwtSecret, {expiresIn: '2h'});
    res.status(201).json({token, user: {id: user.id, username: user.username, role: user.role}});
  });

  router.post('/login', async (req, res) => {
    const {username, password} = req.body || {};
    if (!username || !password) {
      return res.status(400).json({error: 'username and password are required'});
    }
    const users = await dataStore.getCollection('_users');
    const user = users.find((entry) => entry.username === username);
    if (!user) {
      return res.status(401).json({error: 'Invalid credentials'});
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({error: 'Invalid credentials'});
    }
    const token = jwt.sign({id: user.id, username: user.username, role: user.role}, jwtSecret, {expiresIn: '2h'});
    res.json({token, user: {id: user.id, username: user.username, role: user.role}});
  });

  router.get('/me', authenticate, async (req, res) => {
    const users = await dataStore.getCollection('_users');
    const user = users.find((entry) => entry.id === req.user.id);
    if (!user) {
      return res.status(401).json({error: 'User not found'});
    }
    return res.json({id: user.id, username: user.username, role: user.role});
  });

  router.get('/users', authenticate, authorizeRole('admin'), async (req, res) => {
    const users = await dataStore.getCollection('_users');
    res.json(users.map((user) => ({id: user.id, username: user.username, role: user.role, createdAt: user.createdAt})));
  });

  router.patch('/users/:id/role', authenticate, authorizeRole('admin'), async (req, res) => {
    const {role} = req.body || {};
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({error: 'Invalid role'});
    }
    const users = await dataStore.getCollection('_users');
    const user = users.find((entry) => entry.id === req.params.id);
    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }
    user.role = role;
    await dataStore.updateItem('_users', user.id, user);
    return res.json({id: user.id, username: user.username, role: user.role});
  });

  router.post('/teams', authenticate, async (req, res) => {
    const {name} = req.body || {};
    if (!name) {
      return res.status(400).json({error: 'Team name is required'});
    }
    const team = {
      id: uuidv4(),
      name,
      ownerId: req.user.id,
      members: [req.user.id],
      createdAt: new Date().toISOString()
    };
    await dataStore.addItem('_teams', team);
    res.status(201).json(team);
  });

  router.post('/teams/:id/members', authenticate, async (req, res) => {
    const {userId} = req.body || {};
    if (!userId) {
      return res.status(400).json({error: 'userId is required'});
    }
    const teams = await dataStore.getCollection('_teams');
    const team = teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({error: 'Team not found'});
    }
    if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({error: 'Only team owner or admin can add members'});
    }
    const users = await dataStore.getCollection('_users');
    const member = users.find((entry) => entry.id === userId);
    if (!member) {
      return res.status(404).json({error: 'User not found'});
    }
    if (!team.members.includes(userId)) {
      team.members.push(userId);
      await dataStore.updateItem('_teams', team.id, team);
    }
    res.json(team);
  });

  router.get('/teams', authenticate, async (req, res) => {
    const teams = await dataStore.getCollection('_teams');
    if (req.user.role === 'admin') {
      return res.json(teams);
    }
    return res.json(teams.filter((team) => Array.isArray(team.members) && team.members.includes(req.user.id)));
  });

  router.get('/teams/:id', authenticate, async (req, res) => {
    const teams = await dataStore.getCollection('_teams');
    const team = teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({error: 'Team not found'});
    }
    if (req.user.role !== 'admin' && !team.members.includes(req.user.id)) {
      return res.status(403).json({error: 'Forbidden'});
    }
    return res.json(team);
  });

  router.delete('/teams/:id/members/:userId', authenticate, async (req, res) => {
    const teams = await dataStore.getCollection('_teams');
    const team = teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({error: 'Team not found'});
    }
    if (team.ownerId !== req.user.id) {
      return res.status(403).json({error: 'Only team owner can remove members'});
    }
    if (req.params.userId === team.ownerId) {
      return res.status(400).json({error: 'Cannot remove team owner'});
    }
    team.members = (team.members || []).filter((id) => id !== req.params.userId);
    await dataStore.updateItem('_teams', team.id, team);
    return res.json(team);
  });

  router.patch('/teams/:id', authenticate, async (req, res) => {
    const {name} = req.body || {};
    if (!name) {
      return res.status(400).json({error: 'Team name is required'});
    }
    const teams = await dataStore.getCollection('_teams');
    const team = teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({error: 'Team not found'});
    }
    if (team.ownerId !== req.user.id) {
      return res.status(403).json({error: 'Only team owner can rename the team'});
    }
    team.name = name;
    await dataStore.updateItem('_teams', team.id, team);
    return res.json(team);
  });

  router.delete('/teams/:id', authenticate, async (req, res) => {
    const teams = await dataStore.getCollection('_teams');
    const team = teams.find((entry) => entry.id === req.params.id);
    if (!team) {
      return res.status(404).json({error: 'Team not found'});
    }
    if (team.ownerId !== req.user.id) {
      return res.status(403).json({error: 'Only team owner can delete the team'});
    }
    await dataStore.removeItem('_teams', team.id);
    return res.status(204).send();
  });

  return router;
};
