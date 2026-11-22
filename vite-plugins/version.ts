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
// On Workers Builds it is the first 7 characters of the commit that triggered
// the build, matching the Commit column of Cloudflare's preview comment.
export const buildId =
  process.env.BUILD_ID ||
  process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) ||
  git('rev-parse --short=7 HEAD') ||
  'dev'

// Human-readable release tag, for display only. The release tag may not exist
// yet when the deploy builds, so it is never used to detect updates.
export const appVersion = process.env.APP_VERSION || git('describe --tags --exact-match --match "v*"') || 'unreleased'

/**
 * The branch a preview build came from, or null for a production build.
 * Only Workers Builds makes previews: it sets WORKERS_CI_BRANCH for every
 * build, and any branch other than the production branch is a preview.
 * Local, Docker and self-hosted builds have no WORKERS_CI_BRANCH and count
 * as production.
 */
export function previewBranch(env: NodeJS.ProcessEnv = process.env): string | null {
  const branch = env.WORKERS_CI_BRANCH
  if (!branch) return null
  return branch === (env.PRODUCTION_BRANCH || 'main') ? null : branch
}

/**
 * Web URL of a GitHub remote, without credentials, or null for anything else.
 * Accepts https://[token@]github.com/owner/repo[.git] and git@github.com:owner/repo[.git].
 */
export function githubRepoUrl(remote: string | null): string | null {
  const m = remote?.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
  return m ? `https://github.com/${m[1]}/${m[2]}` : null
}

/**
 * Link from a preview to its pull request. scripts/build-release.sh looks the
 * PR up and passes PREVIEW_PR_URL; if that lookup failed, or the PR doesn't
 * exist yet, link to a search for PRs from the branch instead.
 */
export function previewPrUrl(
  branch: string | null,
  repo: string | null = githubRepoUrl(git('remote get-url origin')),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!branch) return null
  if (env.PREVIEW_PR_URL) return env.PREVIEW_PR_URL
  return repo ? `${repo}/pulls?q=${encodeURIComponent(`is:pr head:${branch}`)}` : null
}

/** Contents of version.json. Production builds don't name their branch or PR. */
export function versionInfo(branch: string | null = previewBranch(), pr: string | null = previewPrUrl(branch)) {
  return {
    version: appVersion,
    build: buildId,
    env: branch ? 'preview' : 'production',
    ...(branch && { branch }),
    ...(pr && { pr }),
  }
}

/** Emit version.json alongside the build so the running app can poll it. */
export function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      const source = JSON.stringify(versionInfo())
      // Logged so a build's log shows exactly what its footer will say.
      console.log(`version.json: ${source}`)
      this.emitFile({ type: 'asset', fileName: 'version.json', source })
    },
  }
}
