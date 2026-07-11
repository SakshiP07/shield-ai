import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    origin: 'http://localhost:5173',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // WebSocket: alerts connect directly to ws://127.0.0.1:8000 in dev (see useAlertsWebSocket.ts)
    },
  },
});
