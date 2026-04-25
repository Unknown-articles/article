import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function AuthForm({ onLogin }) {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleTabSwitch = (newMode) => {
        setMode(newMode);
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                return;
            }

            localStorage.setItem('chat_token', data.token);
            localStorage.setItem('chat_user', JSON.stringify({ userId: data.userId, username: data.username }));
            
            onLogin({ token: data.token, user: { userId: data.userId, username: data.username } });
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel auth-panel">
                <h1 className="title">Welcome</h1>
                <div className="auth-tabs">
                    <button 
                        data-testid="tab-login" 
                        className={`tab-btn ${mode === 'login' ? 'active' : ''}`} 
                        onClick={() => handleTabSwitch('login')}
                        type="button"
                    >
                        Login
                    </button>
                    <button 
                        data-testid="tab-register" 
                        className={`tab-btn ${mode === 'register' ? 'active' : ''}`} 
                        onClick={() => handleTabSwitch('register')}
                        type="button"
                    >
                        Register
                    </button>
                </div>

                <form data-testid="auth-form" data-mode={mode} onSubmit={handleSubmit} className="auth-form">
                    {error && <div data-testid="auth-error" className="error-banner">{error}</div>}
                    
                    <div className="form-group">
                        <input 
                            type="text" 
                            data-testid="input-username" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            minLength={3} 
                            required 
                            placeholder="Username"
                        />
                    </div>
                    
                    <div className="form-group">
                        <input 
                            type="password" 
                            data-testid="input-password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                            placeholder="Password"
                        />
                    </div>

                    <button type="submit" data-testid="btn-submit" className="submit-btn">
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
