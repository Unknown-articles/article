import { useEffect, useRef, useState } from "react";
import { LoginPanel } from "./components/AuthForm.jsx";
import { MessageBoard } from "./components/ChatView.jsx";

const CHAT_TOKEN = "chat_token";
const CHAT_USER = "chat_user";

function ConversationApp() {
  const [user, setUser] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem(CHAT_TOKEN);
    const savedUser = localStorage.getItem(CHAT_USER);

    if (!token || !savedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser?.userId && parsedUser?.username) {
        setUser(parsedUser);
      }
    } catch {
      localStorage.removeItem(CHAT_TOKEN);
      localStorage.removeItem(CHAT_USER);
    }
  }, []);

  const submitCredentials = async ({ mode, username, password }) => {
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

    localStorage.setItem(CHAT_TOKEN, data.token);
    localStorage.setItem(
      CHAT_USER,
      JSON.stringify({ userId: data.userId, username: data.username })
    );

    return { userId: data.userId, username: data.username };
  };

  const clearSession = () => {
    localStorage.removeItem(CHAT_TOKEN);
    localStorage.removeItem(CHAT_USER);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setUser(null);
  };

  return (
    <div className="app-shell">
      {user ? (
        <MessageBoard user={user} wsRef={wsRef} onLogout={clearSession} />
      ) : (
        <LoginPanel onSubmit={submitCredentials} onSuccess={setUser} />
      )}
    </div>
  );
}

export default ConversationApp;
