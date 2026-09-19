import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

  let appVersion =
    env.VITE_APP_VERSION ||
    rootEnv.VITE_APP_VERSION ||
    process.env.VITE_APP_VERSION ||
    '';
  if (!appVersion) {
    try {
      const versionFile = path.resolve(__dirname, '../../VERSION');
      if (fs.existsSync(versionFile)) {
        appVersion = fs.readFileSync(versionFile, 'utf-8').trim();
      }
    } catch {}
  }
  if (!appVersion) {
    appVersion = '0.1.0-alpha5';
  }

  let gitCommitHash =
    env.VITE_GIT_COMMIT_HASH ||
    rootEnv.VITE_GIT_COMMIT_HASH ||
    process.env.VITE_GIT_COMMIT_HASH ||
    '';
  if (!gitCommitHash) {
    try {
      gitCommitHash = execSync('git rev-parse --short HEAD', {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8',
      }).trim();
    } catch {
      gitCommitHash = '';
    }
  }

  return {
    plugins: [react()],
    envDir: '../../',
    define: {
      'import.meta.env.VITE_TOAST_DURATION_MS': JSON.stringify(toastDuration),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(gitCommitHash),
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
