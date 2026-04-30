const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('./db');
const { authenticate } = require('./middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    const db = await readDb();
    if (!db._teams) db._teams = [];

    const newTeam = {
      id: uuidv4(),
      name,
      ownerId: req.user.id,
      members: [req.user.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db._teams.push(newTeam);
    await writeDb(db);

    res.status(201).json(newTeam);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/members', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const db = await readDb();
    const team = (db._teams || []).find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!team.members.includes(userId)) {
      team.members.push(userId);
      team.updatedAt = new Date().toISOString();
      await writeDb(db);
    }

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const team = (db._teams || []).find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    team.members = team.members.filter(id => id !== req.params.userId);
    team.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = await readDb();
    let teams = db._teams || [];
    
    if (req.user.role !== 'admin') {
      teams = teams.filter(t => t.members.includes(req.user.id));
    }
    
    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await readDb();
    const team = (db._teams || []).find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (req.user.role !== 'admin' && !team.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    const db = await readDb();
    const team = (db._teams || []).find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    team.name = name;
    team.updatedAt = new Date().toISOString();
    await writeDb(db);

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = await readDb();
    const teamIndex = (db._teams || []).findIndex(t => t.id === req.params.id);
    if (teamIndex === -1) return res.status(404).json({ error: 'Team not found' });

    const team = db._teams[teamIndex];
    if (req.user.role !== 'admin' && team.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db._teams.splice(teamIndex, 1);
    await writeDb(db);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
