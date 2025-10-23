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
