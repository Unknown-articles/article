import { useEffect, useRef, useState } from 'react'
import AuthForm from './components/AuthForm'
import Chat from './components/Chat'

const API_URL = 'http://localhost:5000'
const WS_URL = 'ws://localhost:5000'

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState('')
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [authError, setAuthError] = useState('')
  const wsRef = useRef(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('chat_token')
    const storedUser = localStorage.getItem('chat_user')

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed?.userId && parsed?.username) {
          setUser(parsed)
          setToken(storedToken)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setConnected(false)
      return
    }

    const socket = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = socket
    setConnectionError('')
    setConnected(false)

    socket.addEventListener('open', () => {
      setConnected(true)
      setConnectionError('')
    })

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'history') {
          setMessages(payload.messages || [])
        } else if (payload.type === 'message') {
          setMessages((current) => [...current, payload])
        } else if (payload.type === 'error') {
          setConnectionError(payload.message || 'Connection error')
        }
      } catch (err) {
        console.error(err)
      }
    })

    socket.addEventListener('close', (event) => {
      setConnected(false)
      if (event.code === 4001) {
        setConnectionError('Authentication required')
      } else if (event.code === 4002) {
        setConnectionError('Session expired or invalid token')
        handleLogout()
      } else if (!connectionError) {
        setConnectionError('Disconnected from server')
      }
    })

    socket.addEventListener('error', () => {
      setConnectionError('WebSocket error')
    })

    return () => {
      socket.close()
    }
  }, [token])

  const handleLogout = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    localStorage.removeItem('chat_token')
    localStorage.removeItem('chat_user')
    setUser(null)
    setToken('')
    setMessages([])
    setConnected(false)
    setConnectionError('')
    setAuthError('')
  }

  const handleAuthSuccess = ({ token, userId, username }) => {
    localStorage.setItem('chat_token', token)
    localStorage.setItem('chat_user', JSON.stringify({ userId, username }))
    setUser({ userId, username })
    setToken(token)
    setAuthError('')
    setMessages([])
  }

  const clearAuthError = () => {
    setAuthError('')
  }

  const handleAuthSubmit = async (mode, username, password) => {
    setAuthError('')

    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()
      if (!response.ok) {
        setAuthError(data.error || 'Authentication failed')
        return
      }

      handleAuthSuccess(data)
    } catch (err) {
      console.error(err)
      setAuthError('Unable to reach authentication server')
    }
  }

  const handleSendMessage = (content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('Unable to send message')
      return
    }

    wsRef.current.send(JSON.stringify({ type: 'message', content }))
  }

  return (
    <div className="app-shell">
      {user ? (
        <Chat
          user={user}
          messages={messages}
          connected={connected}
          connectionError={connectionError}
          onLogout={handleLogout}
          onSendMessage={handleSendMessage}
        />
      ) : (
        <AuthForm onSubmit={handleAuthSubmit} onModeChange={clearAuthError} error={authError} />
      )}
    </div>
  )
}

export default App
