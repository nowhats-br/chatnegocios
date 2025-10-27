import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Configuração Vite SIMPLES - sem TypeScript check
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
  esbuild: {
    // Ignorar erros TypeScript no build
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})