import { useState, useEffect, useRef } from 'react'

function MessageRoom({ account, onLogout }) {
  const [connection, setConnection] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [online, setOnline] = useState(false)
  const [problem, setProblem] = useState('')
  const [textInput, setTextInput] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('chat_token')
    if (!token) return

    const wsConnection = new WebSocket(`ws://localhost:3000?token=${token}`)
    setConnection(wsConnection)

    wsConnection.onopen = () => {
      setOnline(true)
      setProblem('')
    }

    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'history') {
        setMsgs(data.messages)
      } else if (data.type === 'message') {
        setMsgs(prev => [...prev, data.message])
      } else if (data.type === 'error') {
        setProblem(data.message)
      }
    }

    wsConnection.onclose = (event) => {
      setOnline(false)
      if (event.code === 4001 || event.code === 4002) {
        onLogout()
      }
    }

    wsConnection.onerror = () => {
      setOnline(false)
      setProblem('WebSocket connection error')
    }

    return () => {
      wsConnection.close()
    }
  }, [onLogout])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [msgs])

  const dispatchMessage = () => {
    const trimmed = textInput.trim()
    if (trimmed && connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({ type: 'message', content: trimmed }))
      setTextInput('')
    }
  }

  const keyHandler = (e) => {
    if (e.key === 'Enter') {
      dispatchMessage()
    }
  }

  const exit = () => {
    if (connection) {
      connection.close()
    }
    onLogout()
  }

  return (
    <div data-testid="chat-container">
      <div data-testid="connection-status" data-connected={online.toString()}>
        {online ? 'Online' : 'Offline'}
      </div>
      <div data-testid="current-username">{account.username}</div>
      <button data-testid="btn-logout" onClick={exit}>Logout</button>
      {problem && <div data-testid="connection-error">{problem}</div>}
      <div data-testid="message-list" ref={listRef}>
        {msgs.length === 0 && <div data-testid="message-empty">No messages yet</div>}
        {msgs.map(msg => (
          <div key={msg.id} data-testid="message-item" data-own={(msg.userId === account.userId).toString()} data-message-id={msg.id}>
            <div data-testid="message-username">{msg.userId === account.userId ? 'You' : msg.username}</div>
            <div data-testid="message-content">{msg.content}</div>
            <div data-testid="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
      <input
        data-testid="input-message"
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyPress={keyHandler}
      />
      <button data-testid="btn-send" onClick={dispatchMessage} disabled={!textInput.trim()}>
        Post
      </button>
    </div>
  )
}

export default MessageRoom