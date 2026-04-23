import { useEffect, useMemo, useRef, useState } from 'react';

const WS_BASE_URL = 'ws://localhost:3000';
const AUTH_CLOSE_CODES = new Set([4001, 4002]);

function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function MessageList({ currentUser, messages }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <p className="message-empty" data-testid="message-empty">
          No messages yet.
        </p>
      ) : (
        messages.map((message) => {
          const isOwn = message.userId === currentUser.userId;

          return (
            <article
              className="message-item"
              data-message-id={message.id}
              data-own={isOwn ? 'true' : 'false'}
              data-testid="message-item"
              key={message.id}
            >
              <div className="message-meta">
                <span data-testid="message-username">
                  {isOwn ? 'You' : message.username}
                </span>
                <time data-testid="message-timestamp">
                  {formatMessageTime(message.timestamp)}
                </time>
              </div>
              <p data-testid="message-content">{message.content}</p>
            </article>
          );
        })
      )}
    </div>
  );
}

function MessageInput({ onSend }) {
  const [value, setValue] = useState('');
  const trimmedValue = useMemo(() => value.trim(), [value]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!trimmedValue) {
      return;
    }

    onSend(trimmedValue);
    setValue('');
  }

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        autoComplete="off"
        data-testid="input-message"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write a message"
        type="text"
        value={value}
      />
      <button
        className="send-button"
        data-testid="btn-send"
        disabled={!trimmedValue}
        type="submit"
      >
        Send
      </button>
    </form>
  );
}

export function ChatView({ onAuthClose, onLogout, socketRef, token, user }) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    socketRef.current = ws;
    setConnectionError('');
    setConnected(false);

    ws.addEventListener('open', () => {
      setConnected(true);
    });

    ws.addEventListener('message', (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch {
        setConnectionError('Received an invalid message from the server');
        return;
      }

      if (payload.type === 'history') {
        setMessages(payload.messages);
        return;
      }

      if (payload.type === 'message') {
        setMessages((currentMessages) => [...currentMessages, payload]);
        return;
      }

      if (payload.type === 'error') {
        setConnectionError(payload.message);
      }
    });

    ws.addEventListener('close', (event) => {
      setConnected(false);

      if (socketRef.current === ws) {
        socketRef.current = null;
      }

      if (AUTH_CLOSE_CODES.has(event.code)) {
        onAuthClose();
      }
    });

    ws.addEventListener('error', () => {
      setConnectionError('Unable to connect to chat server');
    });

    return () => {
      ws.close();

      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [onAuthClose, socketRef, token]);

  function handleSend(content) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  }

  return (
    <div className="chat-container" data-testid="chat-container">
      <header className="chat-header">
        <div>
          <p className="eyebrow">Signed in as</p>
          <h1 data-testid="current-username">{user.username}</h1>
        </div>
        <div className="chat-actions">
          <span
            className="connection-status"
            data-connected={connected ? 'true' : 'false'}
            data-testid="connection-status"
          >
            {connected ? 'Online' : 'Offline'}
          </span>
          <button
            className="logout-button"
            data-testid="btn-logout"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      {connectionError ? (
        <p className="connection-error" data-testid="connection-error">
          {connectionError}
        </p>
      ) : null}

      <MessageList currentUser={user} messages={messages} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
