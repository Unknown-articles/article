import { useEffect, useRef, useState } from "react";
import { AuthPanel } from "./components/AuthForm.jsx";
import { ChatPanel } from "./components/ChatView.jsx";

const SESSION_TOKEN = "chat_token";
const SESSION_USER = "chat_user";

function ChatClient() {
  const [user, setUser] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN);
    const storedUser = localStorage.getItem(SESSION_USER);

    if (!token || !storedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser?.userId && parsedUser?.username) {
        setUser(parsedUser);
      }
    } catch {
      localStorage.removeItem(SESSION_TOKEN);
      localStorage.removeItem(SESSION_USER);
    }
  }, []);

  const processAuthRequest = async ({ mode, username, password }) => {
    const url = `http://localhost:3000/auth/${mode}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Authentication failed");
    }

    localStorage.setItem(SESSION_TOKEN, data.token);
    localStorage.setItem(
      SESSION_USER,
      JSON.stringify({ userId: data.userId, username: data.username })
    );

    return { userId: data.userId, username: data.username };
  };

  const disconnectSession = () => {
    localStorage.removeItem(SESSION_TOKEN);
    localStorage.removeItem(SESSION_USER);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setUser(null);
  };

  return (
    <div className="app-shell">
      {user ? (
        <ChatPanel user={user} wsRef={wsRef} onLogout={disconnectSession} />
      ) : (
        <AuthPanel onSubmit={processAuthRequest} onSuccess={setUser} />
      )}
    </div>
  );
}

export default ChatClient;
