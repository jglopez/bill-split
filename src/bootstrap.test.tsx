import { describe, it, expect, vi } from 'vitest'
import { act } from 'react'
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

  it('refreshes the cached page before reloading from the prompt', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(() => { calls.push('fetch'); return Promise.resolve(new Response('')) })
    vi.stubGlobal('fetch', fetchMock)
    const reload = vi.fn(() => { calls.push('reload') })
    vi.stubGlobal('location', { ...window.location, reload })
    try {
      const { container, root } = await run(() => Promise.reject(new MigrationLoadError(1, new TypeError('Failed to fetch'))))
      await act(async () => { container.querySelector('button')!.click() })
      expect(fetchMock).toHaveBeenCalledWith(import.meta.env.BASE_URL, { cache: 'reload' })
      expect(calls).toEqual(['fetch', 'reload'])
      act(() => root.unmount())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('still renders the app on any other error', async () => {
    const { container, root } = await run(() => Promise.reject(new Error('unexpected')))
    expect(container.textContent).toBe('the app')
    act(() => root.unmount())
  })
})
