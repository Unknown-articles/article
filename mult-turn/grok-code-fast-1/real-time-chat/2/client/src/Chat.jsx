import { useState, useEffect, useRef } from 'react'

function ChatRoom({ currentUser, onLogout }) {
  const [websocket, setWebsocket] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const messagesRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    if (!token) return

    const wsConnection = new WebSocket(`ws://localhost:3000?token=${token}`)
    setWebsocket(wsConnection)

    wsConnection.onopen = () => {
      setIsConnected(true)
      setConnectionError('')
    }

    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'history') {
        setChatMessages(data.messages)
      } else if (data.type === 'message') {
        setChatMessages(prev => [...prev, data.message])
      } else if (data.type === 'error') {
        setConnectionError(data.message)
      }
    }

    wsConnection.onclose = (event) => {
      setIsConnected(false)
      if (event.code === 4001 || event.code === 4002) {
        onLogout()
      }
    }

    wsConnection.onerror = () => {
      setIsConnected(false)
      setConnectionError('WebSocket connection error')
    }

    return () => {
      wsConnection.close()
    }
  }, [onLogout])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatMessages])

  const sendMessage = () => {
    const trimmed = messageInput.trim()
    if (trimmed && websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'message', content: trimmed }))
      setMessageInput('')
    }
  }

  const onKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const logout = () => {
    if (websocket) {
      websocket.close()
    }
    onLogout()
  }

  return (
    <div data-testid="chat-container">
      <div data-testid="connection-status" data-connected={isConnected.toString()}>
        {isConnected ? 'Online' : 'Offline'}
      </div>
      <div data-testid="current-username">{currentUser.username}</div>
      <button data-testid="btn-logout" onClick={logout}>Logout</button>
      {connectionError && <div data-testid="connection-error">{connectionError}</div>}
      <div data-testid="message-list" ref={messagesRef}>
        {chatMessages.length === 0 && <div data-testid="message-empty">No messages yet</div>}
        {chatMessages.map(msg => (
          <div key={msg.id} data-testid="message-item" data-own={(msg.userId === currentUser.userId).toString()} data-message-id={msg.id}>
            <div data-testid="message-username">{msg.userId === currentUser.userId ? 'You' : msg.username}</div>
            <div data-testid="message-content">{msg.content}</div>
            <div data-testid="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
      <input
        data-testid="input-message"
        type="text"
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        onKeyPress={onKeyPress}
      />
      <button data-testid="btn-send" onClick={sendMessage} disabled={!messageInput.trim()}>
        Send
      </button>
    </div>
  )
}

export default ChatRoom