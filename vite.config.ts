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
    cssCodeSplit: false,
    rollupOptions: {
      external: (id) => {
        // Excluir arquivos de teste e stories problemáticos do build
        return id.includes('.test.') || 
               id.includes('.stories.') ||
               id.includes('__tests__') ||
               id.includes('/test/');
      },
      output: {
        manualChunks: undefined,
      }
    },
    chunkSizeWarningLimit: 1000,
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
