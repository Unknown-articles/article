import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles.css';

const mountTarget = document.getElementById('root');

createRoot(mountTarget).render(<App />);
