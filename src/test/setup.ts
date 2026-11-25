import { format } from 'node:util'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Fail any test that writes to console.error or console.warn. React reports
// misuse (bad hook dependencies, missing keys, act() problems) only through
// these, so a passing test could otherwise hide a real bug. A test that
// expects a message replaces the method with vi.spyOn(...).mockImplementation,
// which bypasses this guard until the spy is restored.
const guardedMethods = ['error', 'warn'] as const
type GuardedMethod = (typeof guardedMethods)[number]

const unexpected: { method: GuardedMethod; args: unknown[] }[] = []

for (const method of guardedMethods) {
  const original = console[method].bind(console)
  console[method] = (...args: unknown[]) => {
    unexpected.push({ method, args })
    original(...args)
  }
}

beforeEach(() => {
  unexpected.length = 0
})

afterEach(() => {
  cleanup()
  if (unexpected.length > 0) {
    const first = unexpected[0]
    const count = unexpected.length
    unexpected.length = 0
    throw new Error(
      `Test wrote ${count} unexpected console message(s). First, console.${first.method}: ${format(...first.args)}`,
    )
  }
})
