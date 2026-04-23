import { useState, useEffect, useRef } from 'react'

function Chat({ user, onLogout }) {
  const [ws, setWs] = useState(null)
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [inputValue, setInputValue] = useState('')
  const messageListRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    if (!token) return

    const websocket = new WebSocket(`ws://localhost:3000?token=${token}`)
    setWs(websocket)

    websocket.onopen = () => {
      setConnected(true)
      setError('')
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'history') {
        setMessages(data.messages)
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, data.message])
      } else if (data.type === 'error') {
        setError(data.message)
      }
    }

    websocket.onclose = (event) => {
      setConnected(false)
      if (event.code === 4001 || event.code === 4002) {
        onLogout()
      }
    }

    websocket.onerror = () => {
      setConnected(false)
      setError('WebSocket connection error')
    }

    return () => {
      websocket.close()
    }
  }, [onLogout])

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    const trimmed = inputValue.trim()
    if (trimmed && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content: trimmed }))
      setInputValue('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  const handleLogoutClick = () => {
    if (ws) {
      ws.close()
    }
    onLogout()
  }

  return (
    <div data-testid="chat-container">
      <div data-testid="connection-status" data-connected={connected.toString()}>
        {connected ? 'Online' : 'Offline'}
      </div>
      <div data-testid="current-username">{user.username}</div>
      <button data-testid="btn-logout" onClick={handleLogoutClick}>Logout</button>
      {error && <div data-testid="connection-error">{error}</div>}
      <div data-testid="message-list" ref={messageListRef}>
        {messages.length === 0 && <div data-testid="message-empty">No messages yet</div>}
        {messages.map(msg => (
          <div key={msg.id} data-testid="message-item" data-own={(msg.userId === user.userId).toString()} data-message-id={msg.id}>
            <div data-testid="message-username">{msg.userId === user.userId ? 'You' : msg.username}</div>
            <div data-testid="message-content">{msg.content}</div>
            <div data-testid="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
      <input
        data-testid="input-message"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
      />
      <button data-testid="btn-send" onClick={handleSend} disabled={!inputValue.trim()}>
        Send
      </button>
    </div>
  )
}

export default Chat