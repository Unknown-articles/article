import React, { useState, useEffect } from 'react';
import AuthForm from './AuthForm';
import Chat from './Chat';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const userStr = localStorage.getItem('chat_user');
    
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse user session');
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setUser(null);
  };

  return (
    <>
      {!user ? (
        <AuthForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Chat user={user} onLogout={handleLogout} />
      )}
    </>
  );
}
