import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await register(form.username, form.email, form.password);
      setDone(true);
    } catch (e) {
      setError(e.message);
    }
  };

  if (done) return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Account created!</h2>
        <p>You can now sign in.</p>
        <button className="btn btn-primary" onClick={login}>Sign in</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button type="submit" className="btn btn-primary">Register</button>
        </form>
        <p style={{ marginTop: '1rem' }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
