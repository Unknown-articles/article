import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import sqlite3 from 'sqlite3'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'

const PORT = Number(process.env.PORT || 5000)
const DB_PATH = process.env.DB_PATH || './chat.db'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const ALLOWED_ORIGINS = [FRONTEND_ORIGIN, 'http://localhost:5273']
const JWT_SECRET = process.env.JWT_SECRET || 'change-me'

const app = express()
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true
  })
)
app.use(express.json())

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Unable to open database:', err)
    process.exit(1)
  }
})

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )`)
})

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(this)
    })
  })

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })

const createToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' })
const verifyToken = (token) => jwt.verify(token, JWT_SECRET)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body
  const normalized = typeof username === 'string' ? username.trim() : ''

  if (!normalized || normalized.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' })
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [normalized])
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const result = await run('INSERT INTO users (username, password) VALUES (?, ?)', [normalized, hashed])
    const userId = result.lastID
    const token = createToken({ userId, username: normalized })

    res.status(201).json({ token, userId, username: normalized })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body
  const normalized = typeof username === 'string' ? username.trim() : ''

  if (!normalized || normalized.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' })
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    const user = await get('SELECT id, username, password FROM users WHERE username = ?', [normalized])
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = createToken({ userId: user.id, username: user.username })
    res.json({ token, userId: user.id, username: user.username })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer })

const broadcastMessage = (payload) => {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(payload))
    }
  }
}

wss.on('connection', async (socket, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const token = url.searchParams.get('token')

  if (!token) {
    socket.close(4001, 'Authentication required')
    return
  }

  let auth
  try {
    auth = verifyToken(token)
  } catch (err) {
    socket.close(4002, 'Invalid or expired token')
    return
  }

  if (!auth || !auth.userId || !auth.username) {
    socket.close(4002, 'Invalid or expired token')
    return
  }

  try {
    const user = await get('SELECT id FROM users WHERE id = ? AND username = ?', [auth.userId, auth.username])
    if (!user) {
      socket.close(4002, 'Invalid or expired token')
      return
    }
  } catch (err) {
    console.error(err)
    socket.close(4002, 'Invalid or expired token')
    return
  }

  socket.userId = auth.userId
  socket.username = auth.username

  try {
    const history = await all(
      'SELECT id, user_id AS userId, username, content, timestamp FROM messages ORDER BY id ASC',
      []
    )
    socket.send(JSON.stringify({ type: 'history', messages: history }))
  } catch (err) {
    console.error(err)
    socket.send(JSON.stringify({ type: 'error', message: 'Unable to load history' }))
  }

  socket.on('message', async (data) => {
    try {
      const event = JSON.parse(data.toString())
      if (event.type !== 'message' || typeof event.content !== 'string') {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message payload' }))
        return
      }

      const content = event.content.trim()
      if (!content) {
        socket.send(JSON.stringify({ type: 'error', message: 'Message content must not be empty' }))
        return
      }

      const timestamp = new Date().toISOString()
      const result = await run(
        'INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)',
        [socket.userId, socket.username, content, timestamp]
      )

      const message = {
        type: 'message',
        id: result.lastID,
        userId: socket.userId,
        username: socket.username,
        content,
        timestamp
      }

      broadcastMessage(message)
    } catch (err) {
      console.error(err)
      socket.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }))
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chat backend listening on port ${PORT}`)
})
