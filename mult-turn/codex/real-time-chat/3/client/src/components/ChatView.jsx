import { useEffect, useMemo, useRef, useState } from 'react';

const WS_BASE_URL = 'ws://localhost:3000';
const AUTH_CLOSE_CODES = new Set([4001, 4002]);

function formatClock(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function MessageFeed({ currentUser, messages }) {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list" ref={feedRef}>
      {messages.length === 0 ? (
        <p className="message-empty" data-testid="message-empty">
          No messages yet.
        </p>
      ) : (
        messages.map((message) => {
          const isCurrentUser = message.userId === currentUser.userId;

          return (
            <article
              className="message-item"
              data-message-id={message.id}
              data-own={isCurrentUser ? 'true' : 'false'}
              data-testid="message-item"
              key={message.id}
            >
              <div className="message-meta">
                <span data-testid="message-username">
                  {isCurrentUser ? 'You' : message.username}
                </span>
                <time data-testid="message-timestamp">
                  {formatClock(message.timestamp)}
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

function DraftBox({ onSend }) {
  const [draftValue, setDraftValue] = useState('');
  const sanitizedValue = useMemo(() => draftValue.trim(), [draftValue]);

  function submitDraft(event) {
    event.preventDefault();

    if (!sanitizedValue) {
      return;
    }

    onSend(sanitizedValue);
    setDraftValue('');
  }

  return (
    <form className="message-input-form" onSubmit={submitDraft}>
      <input
        autoComplete="off"
        data-testid="input-message"
        onChange={(event) => setDraftValue(event.target.value)}
        placeholder="Share something with the room"
        type="text"
        value={draftValue}
      />
      <button
        className="send-button"
        data-testid="btn-send"
        disabled={!sanitizedValue}
        type="submit"
      >
        Send
      </button>
    </form>
  );
}

export function ChatView({ onAuthClose, onLogout, socketRef, token, user }) {
  const [isLive, setIsLive] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    socketRef.current = ws;
    setConnectionIssue('');
    setIsLive(false);

    ws.addEventListener('open', () => {
      setIsLive(true);
    });

    ws.addEventListener('message', (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch {
        setConnectionIssue('Received an invalid message from the server');
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
        setConnectionIssue(payload.message);
      }
    });

    ws.addEventListener('close', (event) => {
      setIsLive(false);

      if (socketRef.current === ws) {
        socketRef.current = null;
      }

      if (AUTH_CLOSE_CODES.has(event.code)) {
        onAuthClose();
      }
    });

    ws.addEventListener('error', () => {
      setConnectionIssue('Unable to connect to chat server');
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
          <p className="eyebrow">Connected as</p>
          <h1 data-testid="current-username">{user.username}</h1>
        </div>
        <div className="chat-actions">
          <span
            className="connection-status"
            data-connected={isLive ? 'true' : 'false'}
            data-testid="connection-status"
          >
            {isLive ? 'Online' : 'Offline'}
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

      {connectionIssue ? (
        <p className="connection-error" data-testid="connection-error">
          {connectionIssue}
        </p>
      ) : null}

      <MessageFeed currentUser={user} messages={messages} />
      <DraftBox onSend={handleSend} />
    </div>
  );
}
