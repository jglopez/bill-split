import { describe, it, expect } from 'vitest'
import { githubRepoUrl, previewBranch, previewPrUrl, versionInfo } from './version'

describe('previewBranch', () => {
  it('is null outside Workers Builds', () => {
    expect(previewBranch({})).toBeNull()
  })

  it('is null on the production branch', () => {
    expect(previewBranch({ WORKERS_CI_BRANCH: 'main' })).toBeNull()
    expect(previewBranch({ WORKERS_CI_BRANCH: 'prod', PRODUCTION_BRANCH: 'prod' })).toBeNull()
  })

  it('names any other branch', () => {
    expect(previewBranch({ WORKERS_CI_BRANCH: 'feat/x' })).toBe('feat/x')
    expect(previewBranch({ WORKERS_CI_BRANCH: 'main', PRODUCTION_BRANCH: 'prod' })).toBe('main')
  })
})

describe('githubRepoUrl', () => {
  it('normalizes GitHub remotes and drops credentials', () => {
    expect(githubRepoUrl('https://github.com/o/r')).toBe('https://github.com/o/r')
    expect(githubRepoUrl('https://github.com/o/r/')).toBe('https://github.com/o/r')
    expect(githubRepoUrl('https://x-access-token:abc@github.com/o/r.git')).toBe('https://github.com/o/r')
    expect(githubRepoUrl('git@github.com:o/my.repo.git')).toBe('https://github.com/o/my.repo')
  })

  it('is null for other hosts or no remote', () => {
    expect(githubRepoUrl('https://gitlab.com/o/r.git')).toBeNull()
    expect(githubRepoUrl(null)).toBeNull()
  })
})

describe('previewPrUrl', () => {
  it('is null in production', () => {
    expect(previewPrUrl(null, 'https://github.com/o/r', { PREVIEW_PR_URL: 'x' })).toBeNull()
  })

  it('uses the PR the build looked up', () => {
    expect(previewPrUrl('feat/x', 'https://github.com/o/r', { PREVIEW_PR_URL: 'https://github.com/o/r/pull/7' }))
      .toBe('https://github.com/o/r/pull/7')
  })

  it('falls back to a search for the branch PRs', () => {
    expect(previewPrUrl('feat/x', 'https://github.com/o/r', {}))
      .toBe('https://github.com/o/r/pulls?q=is%3Apr%20head%3Afeat%2Fx')
  })
})

describe('versionInfo', () => {
  it('leaves the branch and PR out of a production build', () => {
    expect(versionInfo(null, null)).toEqual({ version: expect.any(String), build: expect.any(String), env: 'production' })
  })

  it('includes the branch and PR in a preview build', () => {
    expect(versionInfo('feat/x', 'https://github.com/o/r/pull/7'))
      .toMatchObject({ env: 'preview', branch: 'feat/x', pr: 'https://github.com/o/r/pull/7' })
  })
})
