const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { modifyDB, readDB } = require('./db');
const { verifyToken } = require('./auth');

const router = express.Router();

router.use(verifyToken);

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  let newTeam;
  try {
    await modifyDB(async (data) => {
      newTeam = {
        id: uuidv4(),
        name,
        ownerId: req.user.id,
        members: [req.user.id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      data._teams.push(newTeam);
      return data;
    });

    res.status(201).json(newTeam);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'UserId is required' });

  let updatedTeam;
  try {
    await modifyDB(async (data) => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }
      if (!team.members.includes(userId)) {
        team.members.push(userId);
        team.updatedAt = new Date().toISOString();
      }
      updatedTeam = team;
      return data;
    });

    res.status(200).json(updatedTeam);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  const { userId } = req.params;

  let updatedTeam;
  try {
    await modifyDB(async (data) => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      // "team owner" constraint
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }
      
      team.members = team.members.filter(m => m !== userId);
      team.updatedAt = new Date().toISOString();
      updatedTeam = team;
      return data;
    });

    res.status(200).json(updatedTeam);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await readDB();
    let teams;
    if (req.user.role === 'admin') {
      teams = data._teams; // Let admin see all
    } else {
      teams = data._teams.filter(t => t.members.includes(req.user.id));
    }
    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await readDB();
    const team = data._teams.find(t => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (!team.members.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  let updatedTeam;
  try {
    await modifyDB(async (data) => {
      const team = data._teams.find(t => t.id === req.params.id);
      if (!team) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }

      team.name = name;
      team.updatedAt = new Date().toISOString();
      updatedTeam = team;
      return data;
    });

    res.status(200).json(updatedTeam);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await modifyDB(async (data) => {
      const teamIndex = data._teams.findIndex(t => t.id === req.params.id);
      if (teamIndex === -1) {
        const err = new Error('Team not found'); err.status = 404; throw err;
      }
      const team = data._teams[teamIndex];
      if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
        const err = new Error('Not authorized'); err.status = 403; throw err;
      }

      data._teams.splice(teamIndex, 1);
      return data;
    });

    res.status(200).json({ message: 'Deleted' }); // or 204
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = {
  teamsRouter: router
};
