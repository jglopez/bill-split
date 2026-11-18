import { describe, it, expect } from 'vitest'
import { act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { bootstrap } from './bootstrap'
import { MigrationLoadError } from './lib/migrations'

async function run(prepare: () => Promise<void>) {
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(() => bootstrap(root, prepare, <p>the app</p>))
  return { container, root }
}

describe('bootstrap', () => {
  it('renders the app after preparing', async () => {
    const { container, root } = await run(() => Promise.resolve())
    expect(container.textContent).toBe('the app')
    act(() => root.unmount())
  })

  it('shows the reload prompt, not the app, when migration code fails to load', async () => {
    const { container, root } = await run(() => Promise.reject(new MigrationLoadError(1, new TypeError('Failed to fetch'))))
    expect(container.textContent).toContain("Couldn't open your saved bill")
    expect(container.textContent).not.toContain('the app')
    act(() => root.unmount())
  })

  it('still renders the app on any other error', async () => {
    const { container, root } = await run(() => Promise.reject(new Error('unexpected')))
    expect(container.textContent).toBe('the app')
    act(() => root.unmount())
  })
})
