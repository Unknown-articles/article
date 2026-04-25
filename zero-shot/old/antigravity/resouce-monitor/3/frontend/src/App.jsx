import React, { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm.jsx';
import { Chat } from './components/Chat.jsx';
import './index.css'; // Add our modern styling

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('chat_token');
        const userStr = localStorage.getItem('chat_user');
        
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                setSession({ token, user });
            } catch (err) {
                console.error('Failed to parse user from local storage', err);
            }
        }
        setLoading(false);
    }, []);

    const handleLogin = (newSession) => {
        setSession(newSession);
    };

    const handleLogout = () => {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
        setSession(null);
    };

    if (loading) {
        return <div className="app-container">Loading...</div>;
    }

    return (
        <div className="app-container">
            {session ? (
                <Chat session={session} onLogout={handleLogout} />
            ) : (
                <AuthForm onLogin={handleLogin} />
            )}
        </div>
    );
}

export default App;
