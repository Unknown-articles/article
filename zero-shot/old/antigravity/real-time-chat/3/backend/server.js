import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import url from 'url';
import { db } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// Helper function for DB promises
const runQuery = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const getQuery = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const allQuery = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters long" });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await runQuery(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        const userId = result.lastID;
        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ token, userId, username });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: "Username already taken" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token, userId: user.id, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token;

    if (!token) {
        ws.close(4001, 'Authentication required');
        return;
    }

    let user;
    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        ws.close(4002, 'Invalid or expired token');
        return;
    }

    try {
        const history = await allQuery('SELECT * FROM messages ORDER BY timestamp ASC', []);
        const formattedHistory = history.map(msg => ({
            id: msg.id,
            userId: msg.user_id,
            username: msg.username,
            content: msg.content,
            timestamp: msg.timestamp
        }));
        ws.send(JSON.stringify({ type: 'history', messages: formattedHistory }));
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to fetch history' }));
    }

    ws.on('message', async (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'message' && typeof parsed.content === 'string') {
                const insertResult = await runQuery(
                    'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
                    [user.userId, user.username, parsed.content]
                );
                
                const savedMessage = await getQuery('SELECT * FROM messages WHERE id = ?', [insertResult.lastID]);
                
                const broadcastData = JSON.stringify({
                    type: 'message',
                    id: savedMessage.id,
                    userId: savedMessage.user_id,
                    username: savedMessage.username,
                    content: savedMessage.content,
                    timestamp: savedMessage.timestamp
                });
                
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(broadcastData);
                    }
                });
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or server error' }));
        }
    });
});

export { server, app, wss };
