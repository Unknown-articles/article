import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles.css';

const rootNode = document.getElementById('root');
const appRoot = createRoot(rootNode);

appRoot.render(<App />);
