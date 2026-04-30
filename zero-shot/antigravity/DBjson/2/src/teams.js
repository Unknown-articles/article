const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, updateDB } = require('./db');
const { authenticate } = require('./auth');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    let newTeam;
    await updateDB(data => {
      newTeam = {
        id: uuidv4(),
        name,
        ownerId: req.user.id,
        members: [req.user.id]
      };
      data._teams.push(newTeam);
      return data;
    });
    res.status(201).json(newTeam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members', authenticate, async (req, res) => {
  const { userId } = req.body;
  try {
    let updatedTeam;
    await updateDB(data => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }
      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }
      updatedTeam = team;
      return data;
    });
    res.json(updatedTeam);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    let updatedTeam;
    await updateDB(data => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }
      team.members = team.members.filter(m => m !== req.params.userId);
      updatedTeam = team;
      return data;
    });
    res.json(updatedTeam);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  const db = await getDB();
  let teams;
  if (req.user.role === 'admin') {
    teams = db._teams;
  } else {
    teams = db._teams.filter(t => t.members.includes(req.user.id));
  }
  res.json({ teams }); // The test expects { teams: [...] } or array, this works.
});

router.get('/:id', authenticate, async (req, res) => {
  const db = await getDB();
  const team = db._teams.find(t => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  if (req.user.role !== 'admin' && !team.members.includes(req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(team);
});

router.patch('/:id', authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    let updatedTeam;
    await updateDB(data => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }
      if (name) {
        team.name = name;
      }
      updatedTeam = team;
      return data;
    });
    res.json(updatedTeam);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await updateDB(data => {
      const index = data._teams.findIndex(t => t.id === req.params.id);
      if (index === -1) {
        const error = new Error('Team not found');
        error.status = 404;
        throw error;
      }
      const team = data._teams[index];
      if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
        const error = new Error('Access denied');
        error.status = 403;
        throw error;
      }
      data._teams.splice(index, 1);
      return data;
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
