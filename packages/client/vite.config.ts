import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, '../../', '');
  const toastDuration =
    env.VITE_TOAST_DURATION_MS ||
    rootEnv.VITE_TOAST_DURATION_MS ||
    env.TOAST_DURATION_MS ||
    rootEnv.TOAST_DURATION_MS ||
    '4500';

  return {
    plugins: [react()],
    envDir: '../../',
    define: {
      'import.meta.env.VITE_TOAST_DURATION_MS': JSON.stringify(toastDuration),
    },
    server: {
      port: Number(process.env.CLIENT_PORT || rootEnv.CLIENT_PORT) || 3000,
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.SERVER_PORT || rootEnv.SERVER_PORT || 3001}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:${process.env.SERVER_PORT || rootEnv.SERVER_PORT || 3001}`,
          ws: true,
        },
      },
    },
  };
});
