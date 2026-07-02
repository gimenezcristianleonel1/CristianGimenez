import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA offline-first: the app shell is precached so the UI loads with no network,
// and API GETs are cached (NetworkFirst) as a fallback. The real offline data
// store is IndexedDB (Dexie); the Service Worker just keeps the app reachable.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['ICONO.jpeg'],
      manifest: {
        name: 'Ganader-IA',
        short_name: 'Ganader-IA',
        description: 'Gestión ganadera offline-first para el campo',
        theme_color: '#4a5327',
        background_color: '#f4f5f2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'ICONO.jpeg', sizes: '1254x1254', type: 'image/jpeg', purpose: 'any' },
          { src: 'ICONO.jpeg', sizes: '1254x1254', type: 'image/jpeg', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,jpeg,jpg,png,woff2}'],
        // Maneja el click de los avisos de tareas (notificationclick).
        importScripts: ['sw-notifications.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Cache API reads so a recently-loaded screen survives going offline.
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true, port: 5173 },
});
