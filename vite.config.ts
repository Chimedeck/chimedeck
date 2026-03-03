import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ~ maps to src/ so extensions can import shared utils without relative paths
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward all /api requests to the Bun server in dev — avoids CORS.
      // ws: true enables WebSocket upgrade proxying for the realtime endpoint.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // Use the client-specific tsconfig for JSX and DOM types
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        jsx: 'react-jsx',
      },
    },
  },
});
