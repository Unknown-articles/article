const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDB, updateDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const USERS_COLLECTION = '_users';

exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
             return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Hash outside of the updateDB to not block the mutex on CPU intensive task
        const hashedPassword = await bcrypt.hash(password, 10);
        let newUser = null;
        
        const result = await updateDB(async (db) => {
             if (!db[USERS_COLLECTION]) {
                 db[USERS_COLLECTION] = [];
             }
             const existing = db[USERS_COLLECTION].find(u => u.username === username);
             if (existing) return false;
             
             newUser = {
                 id: crypto.randomUUID(),
                 username,
                 password: hashedPassword,
                 role: req.body.role || 'user'
             };
             db[USERS_COLLECTION].push(newUser);
        });
        
        if (result === false) {
             return res.status(409).json({ error: 'User already exists' });
        }
        
        res.status(201).json({ id: newUser.id, username: newUser.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = await getDB();
        
        if (!db[USERS_COLLECTION]) return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = db[USERS_COLLECTION].find(u => u.username === username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.authenticate = (req, res, next) => {
     const authHeader = req.headers.authorization;
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Unauthorized' });
     }
     
     const token = authHeader.split(' ')[1];
     try {
          const payload = jwt.verify(token, JWT_SECRET);
          req.user = payload;
          next();
     } catch (err) {
          res.status(401).json({ error: 'Unauthorized' });
     }
};
