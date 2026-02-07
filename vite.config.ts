import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_URL && env.VITE_API_URL.startsWith('http')
    ? env.VITE_API_URL
    : 'http://localhost:3001';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            xlsx: ['xlsx'],
          },
        },
      },
    },
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
