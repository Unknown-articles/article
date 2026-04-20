import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import authRoutes from './routes/auth.js';
import { verifyToken } from './auth.js';
import { saveMessage, getMessages } from './models/message.js';
import db from './db.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

const clients = new Map();

wss.on('connection', (ws, req) => {
  const token = req.url.split('?token=')[1];
  const user = verifyToken(token);
  if (!user) {
    ws.close();
    return;
  }

  clients.set(ws, user);

  // Send recent messages
  getMessages().then(messages => {
    ws.send(JSON.stringify({ type: 'messages', data: messages }));
  });

  ws.on('message', async (data) => {
    const message = JSON.parse(data);
    if (message.type === 'message') {
      const savedMessage = await saveMessage(user.id, user.username, message.content);
      // Broadcast to all clients
      for (const [client, clientUser] of clients) {
        client.send(JSON.stringify({ type: 'message', data: savedMessage }));
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});