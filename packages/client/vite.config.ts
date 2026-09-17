import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CLIENT_PORT) || 3000,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SERVER_PORT || 3001}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${process.env.SERVER_PORT || 3001}`,
        ws: true,
      },
    },
  },
});
