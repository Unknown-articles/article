import React, { useState, useEffect } from 'react';
import AuthForm from './AuthForm';
import Chat from './Chat';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('rtchat_token');
    const userStr = localStorage.getItem('rtchat_user');
    
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setCurrentUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse currentUser session');
      }
    }
  }, []);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
  };

  const clearSession = () => {
    localStorage.removeItem('rtchat_token');
    localStorage.removeItem('rtchat_user');
    setCurrentUser(null);
  };

  return (
    <>
      {!currentUser ? (
        <AuthForm onLoginSuccess={handleAuthSuccess} />
      ) : (
        <Chat currentUser={currentUser} onLogout={clearSession} />
      )}
    </>
  );
}

