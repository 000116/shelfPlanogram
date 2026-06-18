import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: Vite :5173 — /api istekleri FastAPI (uvicorn) :8080'e proxy'lenir.
// Prod: `npm run build` → ../backend/spa_dist (FastAPI bu klasörü serve eder).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/spa_dist',
    emptyOutDir: true,
  },
})
