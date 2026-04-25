import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import * as url from 'url';
import { initDb, get, all, run } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || username.length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters long" });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }

        const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(409).json({ error: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        
        const userId = result.id;
        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, userId, username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const user = await get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token, userId: user.id, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

const startServer = async () => {
    await initDb();
    
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', async (ws, req) => {
        try {
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

            ws.user = user;

            const history = await all('SELECT * FROM messages ORDER BY timestamp ASC');
            const formattedHistory = history.map(msg => ({
                id: msg.id,
                userId: msg.user_id,
                username: msg.username,
                content: msg.content,
                timestamp: msg.timestamp
            }));

            ws.send(JSON.stringify({
                type: 'history',
                messages: formattedHistory
            }));

            ws.on('message', async (data) => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'message' && typeof parsed.content === 'string') {
                        const result = await run(
                            'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)',
                            [ws.user.userId, ws.user.username, parsed.content]
                        );

                        const savedMsg = await get('SELECT * FROM messages WHERE id = ?', [result.id]);

                        const broadcastMsg = {
                            type: 'message',
                            id: savedMsg.id,
                            userId: savedMsg.user_id,
                            username: savedMsg.username,
                            content: savedMsg.content,
                            timestamp: savedMsg.timestamp
                        };

                        const payload = JSON.stringify(broadcastMsg);
                        wss.clients.forEach((client) => {
                            // Using WebSocket.OPEN which is typically 1 (since we import WebSocketServer from ws, ws is the connection instance, and we can check client.readyState === 1)
                            if (client.readyState === 1) {
                                client.send(payload);
                            }
                        });
                    }
                } catch (err) {
                    console.error('Error handling message:', err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
                }
            });

        } catch (err) {
            console.error('Connection error:', err);
            ws.close(1011, 'Internal server error');
        }
    });
};

startServer().catch(console.error);
