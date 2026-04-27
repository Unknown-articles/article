const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { updateDB, readDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = decoded;
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
};

async function register(username, password) {
  if (!username || !password) {
    throw new Error('Missing username or password');
  }
  return updateDB(data => {
    const users = data._users;
    if (users.find(u => u.username === username)) {
      throw new Error('Username taken');
    }
    const role = users.length === 0 ? 'admin' : 'user';
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    return user;
  });
}

async function login(username, password) {
  const data = await readDB();
  const user = data._users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new Error('Invalid credentials');
  }
  return generateToken(user);
}

async function getUsers() {
  const data = await readDB();
  return data._users.map(u => ({ id: u.id, username: u.username, role: u.role }));
}

async function updateUserRole(id, role) {
  if (!['admin', 'user'].includes(role)) {
    throw new Error('Invalid role');
  }
  return updateDB(data => {
    const user = data._users.find(u => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    user.role = role;
    return user;
  });
}

module.exports = { authMiddleware, adminMiddleware, register, login, getUsers, updateUserRole };