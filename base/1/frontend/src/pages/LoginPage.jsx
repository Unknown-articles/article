import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p>Sign in to access your tasks, chat, and more.</p>
        <button className="btn btn-primary" onClick={login}>Sign in with OIDC</button>
        <p style={{ marginTop: '1rem' }}>No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}
