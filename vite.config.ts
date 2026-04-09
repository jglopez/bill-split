import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The base path must match the deployment path (repo name).
// Override with BASE_PATH env var when serving from a different root (e.g., Docker).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/bill-split/',
  server: {
    allowedHosts: ['.orb.local'],
    watch: {
      usePolling: true,
    },
  },
})
