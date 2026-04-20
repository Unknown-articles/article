import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/oauth2': 'http://localhost:3001',
      '/.well-known': 'http://localhost:3001',
      '/userinfo': 'http://localhost:3001',
      '/metrics': 'http://localhost:3001',
      '/tasks': 'http://localhost:3001',
      '/messages': 'http://localhost:3001',
    },
  },
});
