import React, { useState, useEffect } from 'react';
import AuthForm from './components/AuthForm';
import Chat from './components/Chat';

function App() {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    token: null,
    user: null
  });

  useEffect(() => {
    // Restore session
    const token = localStorage.getItem('chat_token');
    const userStr = localStorage.getItem('chat_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuthState({
          isAuthenticated: true,
          token,
          user
        });
      } catch (err) {
        // Invalid user JSON
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
      }
    }
  }, []);

  const handleAuthSuccess = ({ token, user }) => {
    setAuthState({
      isAuthenticated: true,
      token,
      user
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setAuthState({
      isAuthenticated: false,
      token: null,
      user: null
    });
  };

  return (
    <div className="app-container">
      {authState.isAuthenticated ? (
        <Chat 
          token={authState.token} 
          user={authState.user} 
          onLogout={handleLogout} 
        />
      ) : (
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

export default App;
