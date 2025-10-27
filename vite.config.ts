import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      external: (id) => {
        return id.includes('.test.') ||
          id.includes('.stories.') ||
          id.includes('__tests__') ||
          id.includes('/test/');
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dropdown-menu', '@radix-ui/react-slot'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'motion-vendor': ['framer-motion'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'router-vendor': ['react-router-dom']
        }
      }
    },
    chunkSizeWarningLimit: 500,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy apenas para o webhook do backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: [
      'evochat.nowhats.com.br'
    ]
  }
})
