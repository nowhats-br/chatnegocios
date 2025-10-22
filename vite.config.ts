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
    allowedHosts: ["evochat.nowhats.com.br", "chatvendas.nowhats.com.br"],
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/profiles': 'http://localhost:3001',
      '/connections': 'http://localhost:3001',
      '/messages': 'http://localhost:3001',
      '/conversations': 'http://localhost:3001',
      '/quick_responses': 'http://localhost:3001',
      '/products': 'http://localhost:3001',
      '/tags': 'http://localhost:3001',
      '/contacts': 'http://localhost:3001',
      '/system': 'http://localhost:3001',
      '/api': 'http://localhost:3001'
    }
  },
  preview: {
    allowedHosts: ["evochat.nowhats.com.br", "chatvendas.nowhats.com.br"],
  },
})
