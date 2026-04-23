import { useEffect, useRef, useState } from "react";
import { AuthForm } from "./components/AuthForm.jsx";
import { ChatView } from "./components/ChatView.jsx";

const STORAGE_TOKEN = "chat_token";
const STORAGE_USER = "chat_user";

function App() {
  const [user, setUser] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const rawUser = localStorage.getItem(STORAGE_USER);

    if (!token || !rawUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.userId && parsedUser?.username) {
        setUser(parsedUser);
      }
    } catch {
      localStorage.removeItem(STORAGE_TOKEN);
      localStorage.removeItem(STORAGE_USER);
    }
  }, []);

  const handleAuthSubmit = async ({ mode, username, password }) => {
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

    localStorage.setItem(STORAGE_TOKEN, data.token);
    localStorage.setItem(
      STORAGE_USER,
      JSON.stringify({ userId: data.userId, username: data.username })
    );

    return { userId: data.userId, username: data.username };
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setUser(null);
  };

  return (
    <div className="app-shell">
      {user ? (
        <ChatView user={user} wsRef={wsRef} onLogout={handleLogout} />
      ) : (
        <AuthForm onSubmit={handleAuthSubmit} onSuccess={setUser} />
      )}
    </div>
  );
}

export default App;
