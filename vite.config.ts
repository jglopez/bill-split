import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { appVersion, buildId, previewBranch, previewPrUrl, versionFile } from './vite-plugins/version.ts'

// The app is served from the site root. Set BASE_PATH to host it under a
// subpath instead (it must start and end with a slash).
export default defineConfig({
  plugins: [react(), svgr(), versionFile()],
  base: process.env.BASE_PATH ?? '/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion),
    __PREVIEW_BRANCH__: JSON.stringify(previewBranch()),
    __PREVIEW_PR_URL__: JSON.stringify(previewPrUrl(previewBranch())),
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
    include: ['src/**/*.test.{ts,tsx}', 'vite-plugins/**/*.test.ts'],
    css: false,
    // Node's built-in localStorage (stable since Node 22) requires
    // --localstorage-file to actually work; without it, jsdom's window.localStorage
    // silently delegates to a broken stub. Disable it so jsdom falls back to its
    // own spec-compliant in-memory Storage implementation instead.
    pool: 'forks',
    execArgv: ['--no-experimental-webstorage'],
  },
})
