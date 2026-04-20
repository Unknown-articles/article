import { useEffect, useMemo, useRef, useState } from "react";
import AuthForm from "./components/AuthForm.jsx";
import Chat from "./components/Chat.jsx";

const WS_HOST = "ws://localhost:3000";
const API_HOST = "http://localhost:3000";
const LOCAL_TOKEN_KEY = "chat_token";
const LOCAL_USER_KEY = "chat_user";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const wsRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(LOCAL_TOKEN_KEY);
    const storedUser = localStorage.getItem(LOCAL_USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.userId && parsedUser?.username) {
          setToken(storedToken);
          setUser(parsedUser);
        }
      } catch (error) {
        localStorage.removeItem(LOCAL_TOKEN_KEY);
        localStorage.removeItem(LOCAL_USER_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    setMessages([]);
    setConnectionError("");

    const socket = new WebSocket(`${WS_HOST}?token=${encodeURIComponent(token)}`);
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      setConnectionError("");
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "history" && Array.isArray(payload.messages)) {
          setMessages(payload.messages);
          return;
        }

        if (payload.type === "message") {
          setMessages((prev) => [...prev, payload]);
          return;
        }

        if (payload.type === "error") {
          setConnectionError(payload.message || "WebSocket error received");
        }
      } catch (error) {
        setConnectionError("Unable to process WebSocket data");
      }
    });

    socket.addEventListener("close", (event) => {
      setConnected(false);
      if (event.code === 4001) {
        setConnectionError("Authentication required for WebSocket connection.");
      } else if (event.code === 4002) {
        setConnectionError("Invalid or expired WebSocket token.");
      } else if (event.code !== 1000) {
        setConnectionError("WebSocket connection closed unexpectedly.");
      }
    });

    socket.addEventListener("error", () => {
      setConnected(false);
      setConnectionError("Unable to connect to chat server.");
    });

    return () => {
      socket.close();
    };
  }, [token, user]);

  const currentUserId = useMemo(() => user?.userId ?? null, [user]);

  const handleAuthSuccess = ({ token: newToken, userId, username }) => {
    const authUser = { userId, username };
    setUser(authUser);
    setToken(newToken);
    localStorage.setItem(LOCAL_TOKEN_KEY, newToken);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(authUser));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setMessages([]);
    setConnected(false);
    setConnectionError("");
    localStorage.removeItem(LOCAL_TOKEN_KEY);
    localStorage.removeItem(LOCAL_USER_KEY);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleSendMessage = (content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError("Cannot send message while disconnected.");
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "message", content }));
  };

  return (
    <div className="app-shell">
      {!user ? (
        <AuthForm apiHost={API_HOST} onAuthSuccess={handleAuthSuccess} />
      ) : (
        <Chat
          user={user}
          messages={messages}
          connected={connected}
          connectionError={connectionError}
          onLogout={handleLogout}
          onSendMessage={handleSendMessage}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

export default App;
