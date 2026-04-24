import { useEffect, useMemo, useRef, useState } from 'react';

const WS_BASE_URL = 'ws://localhost:3000';
const AUTH_CLOSE_CODES = new Set([4001, 4002]);

function renderMessageTime(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function TranscriptList({ currentUser, messages }) {
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list" ref={transcriptRef}>
      {messages.length === 0 ? (
        <p className="message-empty" data-testid="message-empty">
          Nenhuma mensagem ainda.
        </p>
      ) : (
        messages.map((entry) => {
          const belongsToCurrentUser = entry.userId === currentUser.userId;

          return (
            <article
              className="message-item"
              data-message-id={entry.id}
              data-own={belongsToCurrentUser ? 'true' : 'false'}
              data-testid="message-item"
              key={entry.id}
            >
              <div className="message-meta">
                <span data-testid="message-username">
                  {belongsToCurrentUser ? 'Voce' : entry.username}
                </span>
                <time data-testid="message-timestamp">
                  {renderMessageTime(entry.timestamp)}
                </time>
              </div>
              <p data-testid="message-content">{entry.content}</p>
            </article>
          );
        })
      )}
    </div>
  );
}

function Composer({ onSend }) {
  const [draft, setDraft] = useState('');
  const sanitizedDraft = useMemo(() => draft.trim(), [draft]);

  function handleComposerSubmit(event) {
    event.preventDefault();

    if (!sanitizedDraft) {
      return;
    }

    onSend(sanitizedDraft);
    setDraft('');
  }

  return (
    <form className="message-input-form" onSubmit={handleComposerSubmit}>
      <input
        autoComplete="off"
        data-testid="input-message"
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Escreva uma mensagem"
        type="text"
        value={draft}
      />
      <button
        className="send-button"
        data-testid="btn-send"
        disabled={!sanitizedDraft}
        type="submit"
      >
        Enviar
      </button>
    </form>
  );
}

export function ChatView({ onAuthClose, onLogout, socketRef, token, user }) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    const chatSocket = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    socketRef.current = chatSocket;
    setSocketError('');
    setIsConnected(false);

    chatSocket.addEventListener('open', () => {
      setIsConnected(true);
    });

    chatSocket.addEventListener('message', (event) => {
      let serverPayload;

      try {
        serverPayload = JSON.parse(event.data);
      } catch {
        setSocketError('Received an invalid message from the server');
        return;
      }

      if (serverPayload.type === 'history') {
        setTimeline(serverPayload.messages);
        return;
      }

      if (serverPayload.type === 'message') {
        setTimeline((currentTimeline) => [...currentTimeline, serverPayload]);
        return;
      }

      if (serverPayload.type === 'error') {
        setSocketError(serverPayload.message);
      }
    });

    chatSocket.addEventListener('close', (event) => {
      setIsConnected(false);

      if (socketRef.current === chatSocket) {
        socketRef.current = null;
      }

      if (AUTH_CLOSE_CODES.has(event.code)) {
        onAuthClose();
      }
    });

    chatSocket.addEventListener('error', () => {
      setSocketError('Unable to connect to chat server');
    });

    return () => {
      chatSocket.close();

      if (socketRef.current === chatSocket) {
        socketRef.current = null;
      }
    };
  }, [onAuthClose, socketRef, token]);

  function handleSendMessage(content) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  }

  return (
    <div className="chat-container" data-testid="chat-container">
      <header className="chat-header">
        <div>
          <p className="eyebrow">Sessao ativa</p>
          <h1 data-testid="current-username">{user.username}</h1>
        </div>
        <div className="chat-actions">
          <span
            className="connection-status"
            data-connected={isConnected ? 'true' : 'false'}
            data-testid="connection-status"
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <button
            className="logout-button"
            data-testid="btn-logout"
            onClick={onLogout}
            type="button"
          >
            Sair
          </button>
        </div>
      </header>

      {socketError ? (
        <p className="connection-error" data-testid="connection-error">
          {socketError}
        </p>
      ) : null}

      <TranscriptList currentUser={user} messages={timeline} />
      <Composer onSend={handleSendMessage} />
    </div>
  );
}
