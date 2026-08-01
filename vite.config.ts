import { defineConfig } from 'vitest/config'
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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Node's built-in localStorage (stable since Node 22) requires
    // --localstorage-file to actually work; without it, jsdom's window.localStorage
    // silently delegates to a broken stub. Disable it so jsdom falls back to its
    // own spec-compliant in-memory Storage implementation instead.
    pool: 'forks',
    execArgv: ['--no-experimental-webstorage'],
  },
})
