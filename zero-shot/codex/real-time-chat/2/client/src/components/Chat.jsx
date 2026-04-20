import { useEffect, useRef, useState } from "react";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

const DEFAULT_WS_URL = "ws://localhost:3000";
const WS_URL = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;

export function Chat({ session, onLogout }) {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(session.token)}`);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setIsConnected(true);
      setConnectionError("");
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "history") {
        setMessages(payload.messages);
        return;
      }

      if (payload.type === "message") {
        setMessages((currentMessages) => [...currentMessages, payload]);
        return;
      }

      if (payload.type === "error") {
        setConnectionError(payload.message);
      }
    });

    socket.addEventListener("close", (event) => {
      setIsConnected(false);

      if (event.code === 4001 || event.code === 4002) {
        onLogout();
        return;
      }

      if (!event.wasClean) {
        setConnectionError("Connection lost. Trying a refresh may help.");
      }
    });

    socket.addEventListener("error", () => {
      setConnectionError("Unable to reach the chat server.");
    });

    return () => {
      socket.close();
    };
  }, [onLogout, session.token]);

  function handleSendMessage(content) {
    const trimmedContent = content.trim();

    if (!trimmedContent || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "message",
        content: trimmedContent,
      }),
    );

    return true;
  }

  return (
    <main className="shell">
      <section data-testid="chat-container" className="chat-shell">
        <header className="chat-header">
          <div>
            <p
              data-testid="connection-status"
              data-connected={isConnected ? "true" : "false"}
              className={`status-pill ${isConnected ? "online" : ""}`}
            >
              {isConnected ? "Online" : "Offline"}
            </p>
            <h1>Signal Room</h1>
          </div>

          <div className="header-actions">
            <p data-testid="current-username" className="current-user">
              {session.user.username}
            </p>
            <button data-testid="btn-logout" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {connectionError ? (
          <p data-testid="connection-error" className="connection-error">
            {connectionError}
          </p>
        ) : null}

        <MessageList currentUserId={session.user.userId} messages={messages} />
        <MessageInput disabled={!isConnected} onSend={handleSendMessage} />
      </section>
    </main>
  );
}
