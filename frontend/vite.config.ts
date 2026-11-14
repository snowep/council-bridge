import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3334',
        changeOrigin: true,
        secure: false,
      },
      '/mcp': {
        target: 'http://localhost:3334',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/health': {
        target: 'http://localhost:3334',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor';
            }
            if (id.includes('@mui/material') || id.includes('@mui/icons-material') || id.includes('@emotion')) {
              return 'mui';
            }
            if (id.includes('@mui/x-data-grid') || id.includes('@mui/x-date-pickers')) {
              return 'charts';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});