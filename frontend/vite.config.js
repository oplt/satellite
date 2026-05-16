import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            devOptions: {
                enabled: false
            },
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
                name: 'My App',
                short_name: 'App',
                description: 'My React PWA Application',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules'))
                        return;
                    if (id.includes('react-router-dom'))
                        return 'router';
                    if (id.includes('@tanstack/react-query'))
                        return 'query';
                    if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
                        return 'forms';
                    }
                    if (id.includes('@mui/x-date-pickers'))
                        return 'mui-date';
                    if (id.includes('@mui/icons-material'))
                        return 'mui-icons';
                    if (id.includes('@emotion/'))
                        return 'emotion';
                    if (id.includes('@mui/system') || id.includes('@mui/styled-engine') || id.includes('@mui/utils')) {
                        return 'mui-system';
                    }
                    if (id.includes('@mui/material'))
                        return 'mui-material';
                    if (id.includes('leaflet') || id.includes('maplibre-gl'))
                        return 'maps';
                }
            }
        }
    }
});
