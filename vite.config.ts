import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** Run a git command, returning its trimmed output or null if git or the repo is unavailable. */
function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null
  } catch {
    return null
  }
}

// Identifies the exact build. The running app compares this against the
// deployed version.json to detect that a newer build is live.
const buildId = process.env.BUILD_ID || git('rev-parse --short HEAD') || 'dev'

// Human-readable release tag, for display only. The release tag may not exist
// yet when the deploy builds, so it is never used to detect updates.
const appVersion = process.env.APP_VERSION || git('describe --tags --exact-match --match "v*"') || 'unreleased'

/** Emit version.json alongside the build so the running app can poll it. */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion, build: buildId }),
      })
    },
  }
}

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
