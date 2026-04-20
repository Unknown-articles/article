import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import './App.css'; // We will put basic styling later

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const userStr = localStorage.getItem('chat_user');
    if (token && userStr) {
      try {
        setSession({ token, user: JSON.parse(userStr) });
      } catch (e) {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
      }
    }
  }, []);

  const handleLogin = (token, user) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    setSession({ token, user });
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setSession(null);
  };

  return (
    <div className="app-container">
      {!session ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <div className="chat-placeholder">
          <header>
            <h1>Real-Time Chat</h1>
            <div className="user-info">
              <span>Welcome, {session.user.username}</span>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </div>
          </header>
          <main className="chat-main">
            <Chat session={session} />
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
