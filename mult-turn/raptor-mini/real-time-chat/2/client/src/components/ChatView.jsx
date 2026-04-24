import { useEffect, useRef, useState } from "react";

const SESSION_TOKEN = "chat_token";
const SESSION_USER = "chat_user";

function formatTimestamp(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ChatPanel({ user, wsRef, onLogout }) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const messageListRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN);
    if (!token) {
      onLogout();
      return;
    }

    const ws = new WebSocket(`ws://localhost:3000?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    const terminateSession = () => {
      localStorage.removeItem(SESSION_TOKEN);
      localStorage.removeItem(SESSION_USER);
      onLogout();
    };

    ws.onopen = () => {
      setConnected(true);
      setConnectionError("");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "history") {
          setMessages(Array.isArray(payload.messages) ? payload.messages : []);
          return;
        }

        if (payload.type === "message") {
          setMessages((prev) => [...prev, payload]);
          return;
        }

        if (payload.type === "error") {
          setConnectionError(payload.message || "Server error");
          return;
        }

        setConnectionError("Invalid server message");
      } catch (error) {
        setConnectionError("Invalid server message");
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        terminateSession();
      }
    };

    ws.onerror = () => {
      setConnectionError("WebSocket connection error");
    };

    return () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      ws.close();
    };
  }, [onLogout, wsRef]);

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    const content = inputMessage.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "message", content }));
    setInputMessage("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  return (
    <div data-testid="chat-container" className="chat-container">
      <div className="chat-header">
        <div>
          <div
            data-testid="connection-status"
            data-connected={connected ? "true" : "false"}
            className={`connection-status ${connected ? "online" : "offline"}`}
          >
            {connected ? "Online" : "Offline"}
          </div>
          <div data-testid="current-username" className="current-username">
            {user.username}
          </div>
        </div>
        <button data-testid="btn-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      {connectionError ? (
        <div data-testid="connection-error" className="connection-error">
          {connectionError}
        </div>
      ) : null}

      <div data-testid="message-list" ref={messageListRef} className="message-list">
        {messages.length === 0 ? (
          <div data-testid="message-empty" className="message-empty">
            No messages yet.
          </div>
        ) : (
          messages.map((message) => {
            const own = message.userId === user.userId;
            return (
              <div
                key={message.id}
                data-testid="message-item"
                data-own={own ? "true" : "false"}
                data-message-id={message.id}
                className={`message-item ${own ? "own" : "other"}`}
              >
                <div data-testid="message-username" className="message-username">
                  {own ? "You" : message.username}
                </div>
                <div data-testid="message-content" className="message-content">
                  {message.content}
                </div>
                <div data-testid="message-timestamp" className="message-timestamp">
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="message-form" onSubmit={handleSubmit}>
        <input
          data-testid="input-message"
          type="text"
          value={inputMessage}
          onChange={(event) => setInputMessage(event.target.value)}
          placeholder="Type a message..."
        />
        <button
          data-testid="btn-send"
          type="submit"
          disabled={inputMessage.trim().length === 0}
        >
          Send
        </button>
      </form>
    </div>
  );
}
