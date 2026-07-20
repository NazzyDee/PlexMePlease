import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false // Disabled in dev so code changes reflect immediately
      },
      manifest: {
        name: 'PlexMePlease',
        short_name: 'PlexMePlease',
        description: 'Request Movies and TV Shows for Plex',
        theme_color: '#0f0f13',
        background_color: '#0f0f13',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
