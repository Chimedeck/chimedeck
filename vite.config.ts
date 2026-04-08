import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

// Sentry source-map upload is only active when an auth token is explicitly provided.
// This ensures local and CI-without-deploy builds never attempt an upload.
// Required env vars: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_RELEASE (optional).
const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN'];
const sentryOrg = process.env['SENTRY_ORG'];
const sentryProject = process.env['SENTRY_PROJECT'];
const sentryRelease = process.env['SENTRY_RELEASE'];
const sentryUploadEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry during deploy builds only.
    // When sentryUploadEnabled is false the plugin is omitted entirely — no network calls.
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: sentryOrg!,
            project: sentryProject!,
            authToken: sentryAuthToken!,
            // Tie uploaded source maps to the same release tag used by the SDK at runtime.
            // Only set when a release identifier is available to avoid a blank tag.
            ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
            // Delete local .map files after upload so they are not served publicly.
            sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
            // Suppress non-essential plugin output in CI logs.
            silent: true,
          }),
        ]
      : []),
  ],
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
  build: {
    // Emit source maps so the Sentry plugin can upload them during deploy builds.
    // The plugin deletes .map files after upload, so they are never served to end-users.
    // In local builds (no SENTRY_AUTH_TOKEN) source maps are still emitted but not uploaded.
    sourcemap: true,
  },
});
