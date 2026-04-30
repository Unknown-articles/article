import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import http from 'http';
import { db, initDb, get, run, query } from './db.js';
import url from 'url';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5273';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters long" });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    try {
        const existingUser = await get(`SELECT id FROM users WHERE username = ?`, [username]);
        if (existingUser) {
            return res.status(409).json({ error: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword]);
        const userId = result.lastID;

        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ token, userId, username });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({ token, userId: user.id, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// WebSocket Server
wss.on('connection', async (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token;

    if (!token) {
        ws.close(4001, "authentication required");
        return;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        ws.close(4002, "invalid or expired token");
        return;
    }

    const { userId, username } = decoded;
    ws.userId = userId;
    ws.username = username;

    try {
        const messages = await query(`SELECT id, user_id as userId, username, content, timestamp FROM messages ORDER BY id ASC`);
        ws.send(JSON.stringify({ type: 'history', messages }));
    } catch (err) {
        console.error("Error fetching history:", err);
    }

    ws.on('message', async (data) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'message' && parsed.content) {
                const content = parsed.content;

                const result = await run(`INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)`, [userId, username, content]);
                const messageId = result.lastID;
                const newMessage = await get(`SELECT id, user_id as userId, username, content, timestamp FROM messages WHERE id = ?`, [messageId]);

                const broadcastMessage = JSON.stringify({
                    type: 'message',
                    id: newMessage.id,
                    userId: newMessage.userId,
                    username: newMessage.username,
                    content: newMessage.content,
                    timestamp: newMessage.timestamp
                });

                wss.clients.forEach(client => {
                    if (client.readyState === ws.OPEN) {
                        client.send(broadcastMessage);
                    }
                });
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
        }
    });
});

initDb().then(() => {
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Database initialization failed:", err);
});
