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
    allowedHosts: ["evochat.nowhats.com.br"],
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    allowedHosts: ["evochat.nowhats.com.br"],
  },
})
