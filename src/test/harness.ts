// Shared test harness for the tsx-based test runner.
// Each test file imports these and calls summary() at the end.

let passed = 0
let failed = 0

export function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function assertEqual<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`${label}\n    expected: ${b}\n    actual:   ${a}`)
}

export function summary() {
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}
