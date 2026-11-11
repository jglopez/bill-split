import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { appVersion, buildId, versionFile } from './vite-plugins/version.ts'

// The base path must match the deployment path (repo name).
// Override with BASE_PATH env var when serving from a different root (e.g., Docker).
export default defineConfig({
  plugins: [react(), versionFile()],
  base: process.env.BASE_PATH ?? '/bill-split/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
