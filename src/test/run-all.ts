// Discovers and runs every *.test.ts under src/, replacing the && chain
// that used to live in package.json. Each file runs in its own process so
// the harness pass/fail counters stay per-file, matching the old behavior.
import { globSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const files = globSync('src/**/*.test.ts').sort()
if (files.length === 0) {
  console.error('no *.test.ts files found under src/')
  process.exit(1)
}

for (const file of files) {
  const result = spawnSync('tsx', [file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
