import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav className="navbar">
      <div className="navbar-brand">FullStack App</div>
      <div className="navbar-links">
        <NavLink to="/" end>Tasks</NavLink>
        <NavLink to="/chat">Chat</NavLink>
        <NavLink to="/metrics">Metrics</NavLink>
      </div>
      <div className="navbar-user">
        <span>{user?.username}</span>
        <button onClick={logout} className="btn btn-sm">Logout</button>
      </div>
    </nav>
  );
}
