import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Печат на билда — показва се в Настройки, за да се вижда с един поглед коя
 * версия върви на телефона. Същият подход като при Корфу.
 */
const BUILD_STAMP = (() => {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(now.getDate())}.${two(now.getMonth() + 1)} · ${two(now.getHours())}:${two(now.getMinutes())}`;
})();

export default defineConfig({
  // Относителна база, за да работи и в подпапка (GitHub Pages, Netlify subpath).
  base: './',

  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        id: './',
        name: 'Крипто портфолио — GTC',
        short_name: 'Портфолио',
        description: 'Проследяване на крипто портфолио. Данните остават на устройството.',
        lang: 'bg',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0F14',
        theme_color: '#0B0F14',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            /**
             * Историческите свещи за графиките. NetworkFirst с кратък таймаут:
             * онлайн взимаме пресни данни, офлайн показваме последните видени,
             * вместо празна графика.
             */
            urlPattern: /^https:\/\/api\.binance\.com\/api\/v3\/klines/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'klines',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/api\.coingecko\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'coingecko',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],

  build: {
    target: 'es2022',
  },
});
