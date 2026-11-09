import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'

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
export const buildId = process.env.BUILD_ID || git('rev-parse --short HEAD') || 'dev'

// Human-readable release tag, for display only. The release tag may not exist
// yet when the deploy builds, so it is never used to detect updates.
export const appVersion = process.env.APP_VERSION || git('describe --tags --exact-match --match "v*"') || 'unreleased'

/** Emit version.json alongside the build so the running app can poll it. */
export function versionFile(): Plugin {
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
