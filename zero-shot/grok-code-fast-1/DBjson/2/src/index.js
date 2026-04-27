const express = require('express');
const { initDB } = require('./db');
const { authMiddleware, adminMiddleware, register, login, getUsers, updateUserRole } = require('./auth');
const { createTeam, getTeams, getTeam, addMember, removeMember, updateTeam, deleteTeam } = require('./teams');
const { handleGet, handleGetOne, handlePost, handlePut, handlePatch, handleDelete } = require('./dynamic');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await register(username, password);
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (e) {
    if (e.message === 'Username taken') {
      res.status(409).json({ error: e.message });
    } else if (e.message === 'Missing username or password') {
      res.status(400).json({ error: e.message });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = await login(username, password);
    res.json({ token });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  const { readDB } = require('./db');
  const data = await readDB();
  const user = data._users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...u } = user;
  res.json(u);
});

app.get('/auth/users', authMiddleware, adminMiddleware, async (req, res) => {
  const users = await getUsers();
  res.json({ users });
});

app.patch('/auth/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await updateUserRole(req.params.id, role);
    const { password: _, ...u } = user;
    res.json(u);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Teams routes
app.post('/auth/teams', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const team = await createTeam(name, req.user.id);
    res.status(201).json(team);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/auth/teams', authMiddleware, async (req, res) => {
  const teams = await getTeams(req.user.id);
  res.json(teams);
});

app.get('/auth/teams/:id', authMiddleware, async (req, res) => {
  try {
    const team = await getTeam(req.params.id, req.user.id);
    res.json(team);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/auth/teams/:id/members', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const team = await addMember(req.params.id, userId, req.user.id);
    res.json(team);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

app.delete('/auth/teams/:id/members/:userId', authMiddleware, async (req, res) => {
  try {
    const team = await removeMember(req.params.id, req.params.userId, req.user.id);
    res.json(team);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

app.patch('/auth/teams/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const team = await updateTeam(req.params.id, name, req.user.id);
    res.json(team);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

app.delete('/auth/teams/:id', authMiddleware, async (req, res) => {
  try {
    await deleteTeam(req.params.id, req.user.id);
    res.status(204).send();
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// Dynamic routes
app.get('/:resource', authMiddleware, handleGet);
app.get('/:resource/:id', authMiddleware, handleGetOne);
app.post('/:resource', authMiddleware, handlePost);
app.put('/:resource/:id', authMiddleware, handlePut);
app.patch('/:resource/:id', authMiddleware, handlePatch);
app.delete('/:resource/:id', authMiddleware, handleDelete);

async function start() {
  await initDB();
  app.listen(port, () => {
    console.log(`running on port ${port}`);
  });
}

start();