import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MigrationLoadFailed } from './MigrationLoadFailed'

describe('MigrationLoadFailed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tells the user their bill is still saved', () => {
    render(<MigrationLoadFailed />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open your saved bill")
    expect(screen.getByRole('alert')).toHaveTextContent('Your bill is still saved')
  })

  it('refreshes the cached page before reloading', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(() => { calls.push('fetch'); return Promise.resolve(new Response('')) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('location', { ...window.location, reload: vi.fn(() => { calls.push('reload') }) })

    render(<MigrationLoadFailed />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    await waitFor(() => expect(calls).toEqual(['fetch', 'reload']))
    expect(fetchMock).toHaveBeenCalledWith(import.meta.env.BASE_URL, { cache: 'reload' })
  })
})
